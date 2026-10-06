# Cloudflare Workers migration (branch `cloudflare`)

MJ Forest Guru runs today on Netlify from `main`. The `cloudflare` branch makes the same
application build and run on **Cloudflare Workers** through the
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter. Nothing has been
deployed. Features and UI are unchanged; `npm run build` (the Netlify build) still passes.

Status, verified locally (`wrangler dev`, workerd runtime, fake Supabase values):

| Check | Result |
|---|---|
| `npx opennextjs-cloudflare build` | passes |
| Worker size (`wrangler deploy --dry-run`) | 15.2 MiB raw / **3.17 MiB gzip** + a 70 KiB WebAssembly module |
| Startup CPU (`wrangler check startup`) | about 42 ms active (limit 1 s) |
| `/` and `/dashboard`, `/map` without a session | 307 → `/login` |
| `/login`, `/offline`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js` | 200 |
| `/api/export/work`, `/api/training/<id>/pdf` without a session | 401 JSON (middleware) |
| `/api/cron/mapon` without / with wrong / with correct bearer | 401 / 401 / 200 |
| Cron Trigger (`/__scheduled?cron=*/10+*+*+*+*`) | calls `/api/cron/mapon` → 200 |
| `/_next/image` (Cloudflare Images binding, local) | 545 KB PNG logo → 40 KB WebP |
| Training-material PDF (real document component, 11 pages, Latvian text) | renders, fonts embedded |
| Security headers on pages and on static files | present (see "Static files") |

Supabase calls failed with DNS errors in that test because the URL was a placeholder. That is
expected. A login with real data has **not** been tested on Workers.

---

## 1. What changed

| File | Why |
|---|---|
| `package.json` | `@opennextjs/cloudflare` and `wrangler` v4 added as devDependencies. Scripts `build:cf-next`, `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen`. **`next` 15.5.26 → 15.5.27** (and `eslint-config-next`): a patch release, required by the adapter's peer range (`next >=15.5.27 <16`). |
| `wrangler.jsonc` | Worker `mj-forest-guru`, compatibility date `2026-09-01`, flags `nodejs_compat` + `global_fetch_strictly_public`, static assets `.open-next/assets` (binding `ASSETS`), Images binding, Cron Trigger, observability, `keep_vars`, plus `alias` / `define` for the PDF renderer (section 5). |
| `open-next.config.ts` | `defineCloudflareConfig()` with the read-only static-assets incremental cache. It also sets the build command to `npm run build:cf-next`. |
| `cloudflare/worker.ts` | The Worker entry. It re-exports the generated `.open-next/worker.js` `fetch` unchanged and adds `scheduled()` for the cron. |
| `cloudflare/wasm.ts`, `cloudflare/shims/node-module.ts` | Workers-only runtime fixes for `@react-pdf/renderer` (section 5). |
| `scripts/cloudflare/prepare.ts` | Runs before `next build` in the Cloudflare build only. It generates (all git-ignored) `cloudflare/.generated/yoga.wasm`, `public/pdf-fonts/*`, and `public/_headers`. |
| `src/lib/training/pdf/document.tsx`, `src/app/api/training/[id]/pdf/route.ts` | On Workers the PDF fonts are fetched from static assets instead of read from disk. Node/Netlify behaviour is unchanged: `npx tsx scripts/export-training-pdfs.tsx` still renders all 13 PDFs. |
| `tsconfig.json`, `eslint.config.mjs`, `.gitignore` | Exclude build output (`.open-next`, `.wrangler`) and the Workers-only `cloudflare/` folder from the Next type-check. Git-ignore `.dev.vars` and the generated files. |
| `.dev.vars.example` | Template for local preview secrets. The real `.dev.vars` is git-ignored. |

`wrangler.jsonc` → `main` is `cloudflare/worker.ts`, not `.open-next/worker.js`. Wrangler only
calls a `scheduled()` handler exported by the main module, and the generated OpenNext worker has
none. The wrapper imports the generated worker and passes `fetch` through untouched.

`netlify.toml`, `next.config.ts` and every other file used by the Netlify build are unchanged.

### How the build runs

```
npx opennextjs-cloudflare build
  └─ npm run build:cf-next                (open-next.config.ts → buildCommand)
       ├─ tsx scripts/cloudflare/prepare.ts   yoga.wasm, pdf-fonts, _headers
       └─ npm run build                       same as Netlify: prebuild (MapLibre worker copy) + next build
  └─ OpenNext bundles .open-next/
npx opennextjs-cloudflare deploy          populates the static-assets cache, then wrangler deploy
```

## 2. Environment variables

`NEXT_PUBLIC_*` values are **inlined at build time**, by Next.js and by the CSP generator. They
must be set as **build variables**. Everything else is read at **runtime** and must be set on the
Worker. Setting a variable in the wrong place has no effect.

### Build variables
Set them in Workers & Pages → `mj-forest-guru` → Settings → Build → Variables and secrets.

| Variable | Required | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same as Netlify. It also feeds the CSP. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Same as Netlify. Or `NEXT_PUBLIC_SUPABASE_ANON_KEY` if Netlify uses that. |
| `NEXT_PUBLIC_APP_URL` | yes | The production URL, the same value as on Netlify (e.g. `https://app.mjforestguru.com`). |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | no | Same as Netlify, if set there. |
| `NODE_VERSION` | recommended | `22`, matching `netlify.toml`. |
| `NEXT_TELEMETRY_DISABLED` | no | `1` |

Do **not** set `NODE_ENV=production` as a build variable. The build needs devDependencies
(`@opennextjs/cloudflare`, `wrangler`, `tsx`).

### Runtime variables and secrets
Set them in Workers & Pages → `mj-forest-guru` → Settings → Variables and Secrets, or with
`npx wrangler secret put NAME`.

| Variable | Type | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Netlify currently stores it as `UPABASE_SERVICE_ROLE_KEY` (typo, see `src/lib/env.server.ts`). The code accepts both; use the correct name here. `SUPABASE_SECRET_KEY` is also accepted. |
| `CRON_SECRET` | **secret** | At least 16 characters. Without it, the Cron Trigger logs a skip and does nothing, and `/api/cron/*` answers 503. |
| `MAPON_API_KEY` | secret | Optional. It overrides the key saved in the UI. |
| `RESEND_API_KEY` | secret | Optional (in-app e-mails). |
| `ANTHROPIC_API_KEY` | secret | Optional (training-material drafts). |
| `RECEIPT_OCR_TOKEN` | secret | Optional. |
| `MAPON_API_URL` | variable | Optional. |
| `EMAIL_FROM` | variable | Optional. |
| `ANTHROPIC_MODEL` | variable | Optional. |
| `RECEIPT_OCR_ENDPOINT` | variable | Optional. |
| `SHOW_DEMO_ORGS` | variable | Copy it only if Netlify has it set. |

`ALLOW_DEMO_SEED` and `DATABASE_URL` are used by the local scripts and tests only. Do not set
them on the Worker.

`keep_vars: true` in `wrangler.jsonc` keeps dashboard-set plain variables across deploys.
Secrets are always kept.

> **Never deploy from a laptop that has `.env.local` with real values.** OpenNext inlines
> `.env*` files that exist at build time into the Worker bundle. In Workers Builds (CI), no
> `.env*` files exist, so this does not happen there.

## 3. Workers Builds settings

Connect the GitHub repository in Workers & Pages → Create → Import a repository →
`Amberace88/mj-forest-guru`. The Worker name must be **`mj-forest-guru`**, the same as in
`wrangler.jsonc`.

| Setting | Value |
|---|---|
| Production branch | `cloudflare` (switch to `main` once `cloudflare` is merged) |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Non-production branch deploy command | `npx opennextjs-cloudflare upload` (optional, preview versions) |
| Root directory | `/` |
| Build variables | see section 2 |

The commits on this branch contain `[skip netlify]`, so Netlify does not spend build minutes on
them.

## 4. Cron (Mapon sync)

On Netlify, an external scheduler calls `GET /api/cron/mapon` with
`Authorization: Bearer $CRON_SECRET` (see `netlify.toml` and README).

On Workers, `wrangler.jsonc` → `triggers.crons: ["*/10 * * * *"]` fires
`cloudflare/worker.ts` → `scheduled()` every 10 minutes. It builds that exact request with
`CRON_SECRET` from the Worker environment and passes it to the Next.js handler **in-process**:
there is no public network hop, and the route's own bearer check still runs. Behaviour:

- If `CRON_SECRET` is not set, it logs `[cron] … skipped` and makes no call.
- A non-2xx response throws, so the run shows as failed in Workers → Logs / Cron events.
- Each run logs its status, duration and the route's JSON summary (counts only).

**At cut-over, switch the external scheduler off** (cron-job.org or similar). Otherwise both
schedulers run, which is harmless but doubles the Mapon API calls. The route itself stays public
and bearer-protected, so the external scheduler keeps working until it is switched off.

The optional daily tender refresh (`/api/cron/tenders`) is already mapped in `worker.ts` to the
expression `17 5 * * *`. It is **not** enabled. To enable it, add that expression to
`triggers.crons`.

Test it locally with
`npx wrangler dev --test-scheduled` and then `curl "http://localhost:8787/__scheduled?cron=*/10+*+*+*+*"`.

## 5. Runtime compatibility audit

| Area | Finding | Resolution |
|---|---|---|
| **`@react-pdf/renderer`** (`/api/training/[id]/pdf`) | Three blockers on workerd. (1) Yoga compiles its WebAssembly from a base64 string at runtime, which Workers forbid. (2) pdfkit loads its 14 standard fonts with `createRequire(import.meta.url)("#standard-fonts/…")` from disk. (3) pdfkit and Yoga read `import.meta.url` at module load, and it is undefined inside the bundle. | (1) `prepare.ts` extracts the identical binary into `cloudflare/.generated/yoga.wasm`. Wrangler uploads it as a precompiled module. `cloudflare/wasm.ts` hands it to Yoga only when the bytes match (length + SHA-256). (2) `wrangler.jsonc` → `alias.module` → `cloudflare/shims/node-module.ts` answers those 14 ids from statically bundled data (~90 KB) and delegates everything else. (3) `define` gives `import.meta.url` a constant. **Verified:** the real 11-page training document renders on workerd with fonts embedded and Latvian diacritics intact. |
| PDF fonts (`fs` at runtime) | `registerPdfFonts()` passed disk paths to fontkit, and Workers have no file system. | On Workers (`navigator.userAgent === "Cloudflare-Workers"`), fonts are fetched from `<request origin>/pdf-fonts/*.ttf`. `prepare.ts` copies them there; they are OFL-licensed and the licences are copied with them. They load once per isolate. Node/Netlify still reads from disk. |
| Other `fs` / `path` / `process.cwd()` | `PDF_FONT_DIR` uses `path` and `process.cwd()` only to build a string. There are no other runtime file reads. `node:crypto` (`timingSafeEqual`, `createHash`, `randomBytes`) is supported by `nodejs_compat`. | No change needed. |
| `sharp` / `next/image` | Not installed. `next/image` is used for the logo and emblem (PNG, up to 545 KB). | Cloudflare **Images binding** (`IMAGES`). The free allowance was 5,000 unique transformations a month when this was written (confirm in the Images dashboard); this app needs about 10. Without the binding, OpenNext serves the original image (correct but heavier). `images.unoptimized` was therefore not needed. |
| MapLibre | Its worker is copied to `public/maplibre/<version>/` by `prebuild`, which still runs inside the CF build. Tiles are fetched by the browser. | Verified served with `Cache-Control: immutable`. |
| Static files | Workers serve `public/` and `_next/static` without running Next.js, so `next.config.ts` headers (CSP, HSTS, X-Frame-Options, `/sw.js` no-cache) would be missing on them. | `prepare.ts` generates `public/_headers` from `next.config.ts` itself (5 rules), plus immutable caching for `/_next/static/*`. Verified on `/sw.js`, `/maplibre/*` and `_next/static/*`. |
| ISR / caching | No ISR. Every app page is dynamic (session cookies). | Read-only static-assets incremental cache: no KV, R2 or Durable Objects. `revalidatePath()` in server actions may log harmless "read-only cache" messages. |
| `export const runtime = "nodejs"` / `maxDuration = 60` | Ignored on Workers. | Workers Paid: 30 s CPU per request by default (raise with `limits.cpu_ms` if ever needed). Wall-clock time is not limited while the client is connected. The Mapon route has its own 50 s budget. |
| `color-string` "Failed to copy" during the build | Logged by OpenNext while copying traced files. The package's runtime files are present and bundled. | Harmless. The PDF that uses it renders. |

### Degraded or changed behaviour

- **Rate limiting is weaker.** `src/lib/rate-limit.ts` counts in memory per instance. Workers
  run many short-lived isolates across locations, so the per-instance counters reset more often
  than on Netlify. Supabase Auth's own limits still apply. If this matters, use the Workers Rate
  Limiting binding or a Durable Object; that is not part of this branch.
- **PDF generation depends on the shims.** They match pdfkit 0.20 / yoga-layout 3.2 as installed.
  If `prepare.ts` cannot find Yoga's binary, the build **fails loudly**. If a future upgrade
  changes pdfkit's font loading, only the PDF route fails, with the existing friendly error
  (500 + `errors.generic`). **Re-test a PDF download after upgrading `@react-pdf/renderer`.**
- **PDF CPU time:** about 1.2 s for an 11-page document locally. This is fine on Workers Paid and
  impossible on Free.
- The fonts at `/pdf-fonts/*.ttf` are publicly downloadable (OFL-licensed). On Netlify they are
  not served at all.

## 6. Is Workers Paid ($5/month) needed?

**Yes.**

1. **Size:** the Worker is 3.17 MiB gzip. The Free plan limit is 3 MiB; Paid allows 10 MiB.
2. **CPU:** Free allows 10 ms CPU per request. Server-rendering these pages and the Supabase
   client already exceed that routinely, and a PDF takes about 1.2 s. Paid allows 30 s by default.

Paid includes 10 M requests and 30 M CPU-ms per month, far more than a private team app uses.
Cron Triggers, static-asset requests and observability logs need nothing extra. The Images
binding stays free within its monthly allowance of unique transformations (5,000 when
written), and this app uses about 10.

## 7. Custom domains (at cut-over, not before)

The code and README use **`app.mjforestguru.com`** as the production URL (`NEXT_PUBLIC_APP_URL`,
Supabase Auth redirects, cron examples). `mjforestguru.com` also appears in the tender-cron
comment and in `EMAIL_FROM`. Attach all three hostnames to the Worker:

1. The `mjforestguru.com` zone must be on Cloudflare: the nameservers move to Cloudflare. Recreate
   any existing DNS records first, **especially MX / SPF / DKIM for e-mail**.
2. Workers & Pages → `mj-forest-guru` → Settings → Domains & Routes → Add → Custom domain:
   `app.mjforestguru.com`, `mjforestguru.com`, `www.mjforestguru.com`. Cloudflare creates the DNS
   records and certificates. Remove the old Netlify CNAME / A records for those names first,
   otherwise the add is refused.
3. Optional: a Redirect Rule `www` → the canonical host.
4. Keep `NEXT_PUBLIC_APP_URL` and the Supabase Auth **Site URL / Redirect URLs** on the canonical
   host. If the canonical host changes, update both and **rebuild**, because `NEXT_PUBLIC_*` is
   inlined.
5. To test before cut-over, use the `*.workers.dev` URL. Add `https://mj-forest-guru.<account>.workers.dev/**`
   to the Supabase Redirect URLs, or logins will bounce to production.
6. When cut over: switch off the external Mapon cron (section 4), then the Netlify site. The
   `routes` block in `wrangler.jsonc` can then be uncommented to pin the domains in code.

## 8. Local preview

```bash
cp .dev.vars.example .dev.vars          # fake or test values only
export NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… NEXT_PUBLIC_APP_URL=http://localhost:8787
npm run cf:preview                      # build + populate local cache + wrangler dev
```

`npm run cf:typegen` generates `cloudflare-env.d.ts` (git-ignored) if binding types are ever
needed in app code.
