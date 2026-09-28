# MJ Forest Guru

**Privāta mežsaimniecības operāciju platforma · Private Forestry Operations Platform**
People. Machines. Projects. Operations.

---

## Ātrais starts (latviski)

1. `npm install` un `cp .env.example .env.local`. Aizpildiet Supabase URL, publishable key, service role key un `NEXT_PUBLIC_APP_URL`.
2. Supabase projektā palaidiet visas migrācijas no `supabase/migrations/` (secībā pēc faila nosaukuma).
3. Supabase → Authentication: **izslēdziet publisko reģistrāciju**, iestatiet Site URL un Redirect URLs, ielīmējiet e-pasta veidnes no `supabase/templates/` un konfigurējiet savu SMTP (piem., Resend).
4. Izveidojiet pirmo īpašnieku:
   `npm run setup:owner -- --email maris@uznemums.lv --name "Māris Bērziņš" --company "MJ Forest"`
5. `npm run dev` → atveriet saiti no e-pasta, iestatiet paroli un pieslēdzieties. Automātiski sāksies iestatīšanas vednis.
6. Produkcija: Netlify + domēns `app.mjforestguru.com` (CNAME). Mapon sinhronizācijai iestatiet ārēju cron uz `/api/cron/mapon`.

Demo datus drīkst ģenerēt **tikai izstrādes vidē** (`ALLOW_DEMO_SEED=true npm run seed:demo …`). Tie ir atzīmēti ar DEMO, un tos var pilnībā dzēst.

---

## Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Security model](#security-model)
5. [Local development](#local-development)
6. [Supabase setup](#supabase-setup)
7. [Environment variables](#environment-variables)
8. [First run](#first-run)
9. [Demo data](#demo-data)
10. [Deployment (Netlify + app.mjforestguru.com)](#deployment)
11. [Mapon integration](#mapon-integration)
12. [Maps](#maps)
13. [PWA and offline behaviour](#pwa-and-offline-behaviour)
14. [Testing](#testing)
15. [Localization](#localization)
16. [Security checklist](#security-checklist)
17. [Backups and recovery](#backups-and-recovery)
18. [Troubleshooting](#troubleshooting)

---

## Overview

MJ Forest Guru is a **private** operations platform for a forestry company working in Latvia, Sweden and Iceland. Owners get full operational visibility over people, machines, work sites (*darba objekti*), working hours, fuel, expenses, maintenance, production and safety. Employees get a fast, mobile-first tool for check-in/check-out, fuel, receipts, repairs and incidents, and it keeps working offline in the forest.

There is **no public registration, no public pages and no public data**. Unauthenticated visitors see only the login screen. Accounts exist only through an owner/admin invitation.

## Features

| Area | Highlights |
| --- | --- |
| Command center | Role-specific dashboards (owner, manager, foreman, mechanic, employee), rule-based alerts, live map |
| People | Employees, teams, working hours with approvals and audited corrections, training/certificates |
| Operations | Work sites with country-specific identifiers (cirsmas/kadastra nr., fastighet…), tasks (board), production |
| Fleet | Machines, assignments, fuel, maintenance, repair workflow with before/after photos and parts |
| Finance | Expenses with approval flow, private receipt storage, per-currency totals (EUR/SEK/ISK, never converted) |
| Safety | Versioned safety rules with acknowledgements, incidents with investigation and corrective actions |
| Analytics and reports | People/fleet/fuel/project/country analytics, CSV exports, printable monthly management report |
| System | Settings, users and invitations, role × permission matrix, integrations (Mapon), immutable audit log |

## Architecture

```
Browser (PWA, Latvian UI) ──► Next.js 15 App Router on Netlify
                                ├─ Server Components / Server Actions  (user-scoped Supabase client → RLS)
                                ├─ /api/export/*, /api/sync            (user-scoped, permission-checked)
                                └─ /api/cron/mapon                     (CRON_SECRET → service role, server only)
                                          │
                     Supabase: Postgres (RLS on every table) · Auth · private Storage buckets
                                          │
                     Mapon API (GPS / CAN telemetry, server-side only)
```

* **Stack:** Next.js 15, React 19, TypeScript (strict), Tailwind CSS v4, Supabase (`@supabase/ssr`), zod v4, MapLibre GL, Recharts, lucide-react.
* **Data access:** every page and server action calls `requireOrg()` (`src/lib/context.ts`) and uses `ctx.supabase`, a client that acts **as the signed-in user**, so PostgreSQL RLS decides what is visible. Queries also filter by `organization_id`.
* **Service role** (`src/lib/supabase/admin.ts`) is used only where RLS cannot apply: auth invitations (`src/lib/invite.ts`), integration secrets and Mapon sync (`src/lib/integrations/mapon.ts`), the cron route and the setup scripts. It is imported only from `server-only` modules.
* **Schema:** `supabase/migrations/*.sql`; generated types in `src/lib/database.types.ts`.
* **i18n:** all UI strings live in `src/i18n/lv.ts` (type-checked keys).
* **Conventions:** see [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

```
src/app/(auth)          login, forgot/reset password
src/app/auth/confirm    token-hash verification for invite / recovery e-mails
src/app/(app)/…         product modules (dashboard, projects, employees, machines, settings…)
src/app/api/cron/mapon  scheduled Mapon sync
src/lib/                context, permissions, actions, env, supabase clients, integrations
supabase/migrations     schema, RLS, RPCs, bootstrap, demo generator, hardening
supabase/templates      Latvian auth e-mail templates
scripts/                setup-owner, seed-demo, DB test setup
tests/rls               RLS / authorization test-suite
```

## Security model

* **Organization isolation:** every company table has `organization_id`. RLS helpers (`app.is_member`, `app.has_perm`) require an **active** membership in that organization. Cross-organization references are rejected by triggers (`app.assert_same_org`, `ROLE_ORG_MISMATCH`).
* **Roles and permissions:** six system roles (owner, admin, manager, foreman, mechanic, employee) map to 34 granular permissions (`role_permissions`). Policies check **permissions**, not role names. The owner role always keeps its core permissions (DB guard), the **last owner cannot be removed** (`LAST_OWNER`), and only holders of `manage_permissions` can grant or revoke owner/admin.
* **Scoped visibility:** without `view_all_*` permissions users see their own records plus what falls within their managerial scope (their teams and projects). Finance, salaries and GPS history have their own permissions.
* **Private storage:** the buckets `receipts`, `documents` and `media` are private. Objects are readable only when a matching `public.files` row is visible under RLS. The app serves short-lived signed URLs.
* **Service role:** server-only (`import "server-only"`), never exposed to the browser. Integration secrets live in `integration_secrets`, a table with **no** RLS policies, so only the service role can read it. Only the last 4 characters are ever shown.
* **Audit:** triggers write an append-only `audit_logs` row (who, what, old/new values, IP, user agent) for all business tables, role and permission changes, integrations and invitations. UPDATE and DELETE on the log are blocked.
* **Soft delete:** business records are archived or soft-deleted (`deleted_at`) and never hard-deleted by the app.
* **HTTP hardening** (`next.config.ts`): CSP (`frame-ancestors 'none'`, Supabase and tile hosts allow-listed, `unsafe-eval` only in development), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(self)`, and `X-Powered-By` removed. The middleware adds `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.
* **Auth redirects** are built from `NEXT_PUBLIC_APP_URL` (never localhost in production), and `next=` parameters accept only same-site relative paths.
* **Rate limiting:** login, password reset, invitations and Mapon test/sync are rate-limited per instance. Supabase Auth adds its own global limits.

## Local development

Requirements: Node.js 20+ (22 recommended) and a Supabase project (cloud or `supabase start`).

```bash
npm install
cp .env.example .env.local        # fill in the values
npm run dev                       # http://localhost:3000
npm run typecheck                 # tsc --noEmit
npm run lint
npm test                          # unit tests (+ RLS tests when DATABASE_URL is set)
```

Regenerate DB types after schema changes: `python3 scripts/gen-db-types.py` (or `supabase gen types typescript`).

## Supabase setup

### 1. Migrations

Apply every file in `supabase/migrations/` **in filename order**:

| # | File | Content |
| --- | --- | --- |
| 0100 | `core_organizations_roles` | organizations, settings, countries, profiles, membership, roles, permissions, auth helpers |
| 0200 | `people_projects_machines` | lookups, employees, teams, projects, work sites, machines, assignments |
| 0300 | `work_tasks_comms` | work logs, production, tasks, comments, notifications |
| 0400 | `fuel_finance_maintenance` | fuel, receipts, expenses, maintenance, repairs |
| 0500 | `safety_incidents_documents` | safety rules and acknowledgements, training, incidents, documents, files |
| 0600 | `gps_integrations_audit` | GPS, Mapon tables, integration settings and secrets, invitations, audit log |
| 0700 | `rls_policies` | RLS on every table, guard triggers, private storage buckets and policies |
| 0800 | `rpc_dashboard_analytics` | dashboard, alerts and analytics RPCs |
| 0900 | `bootstrap_and_membership` | `bootstrap_organization`, `add_organization_member` (service role only) |
| 1000 | `demo_seed_function` | `seed_demo_data` (service role only, `is_demo` organizations only) |
| 1100 | `security_hardening` | function privileges; the migration fails if any public table lacks RLS |

With the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`. Alternatively, paste each file into the SQL editor in order. Never change the production schema outside migrations.

### 2. Authentication settings

Supabase Dashboard → **Authentication**:

* **Sign In / Providers → Email:** enabled. **Allow new users to sign up: OFF** (no public registration). Confirm email: ON.
* **URL Configuration:**
  * Site URL: `https://app.mjforestguru.com` (local: `http://localhost:3000`)
  * Redirect URLs: `https://app.mjforestguru.com/**`, `http://localhost:3000/**` (plus Netlify deploy-preview URLs if you use them)
* **Email Templates:** paste the files from `supabase/templates/`:

  | Template | File | Link |
  | --- | --- | --- |
  | Invite user | `invite.html` | `/auth/confirm?token_hash=…&type=invite&next=/reset-password?welcome=1` |
  | Reset password | `recovery.html` | `/auth/confirm?token_hash=…&type=recovery&next=/reset-password` |
  | Magic link | `magic_link.html` | `/auth/confirm?token_hash=…&type=magiclink` |
  | Confirm signup | `confirmation.html` | `/auth/confirm?token_hash=…&type=signup` |

  The links use `{{ .SiteURL }}` and `{{ .TokenHash }}`, so they work on any device without a PKCE verifier. Subjects: *"Uzaicinājums uz MJ Forest Guru"*, *"Paroles atjaunošana"*, *"Pieteikšanās saite"*, *"Apstipriniet e-pastu"*.
* **Email OTP expiration:** set it to the maximum (86400 s). The app tracks its own **7-day** invitation window and can re-send.
* **SMTP (important):** Supabase's built-in SMTP delivers **only to members of your Supabase team** and is heavily rate-limited, so invitations to employees will not arrive. Configure **custom SMTP** (Authentication → Emails → SMTP Settings). For example, with Resend: host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender `no-reply@mjforestguru.com` (verify the domain in Resend with SPF/DKIM).
* **Sessions:** optionally set an inactivity timeout / time-box (Auth → Sessions) to match your policy.

### 3. Storage

Migration 0700 creates the private buckets `receipts` (20 MB), `documents` (50 MB) and `media` (50 MB) with MIME allow-lists. Check in Storage that none of them is marked *Public*.

## Environment variables

See [`.env.example`](.env.example). Variables without `NEXT_PUBLIC_` are **server-only**.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase project URL (also added to the CSP) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | yes | Publishable key (`sb_publishable_…`). The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted |
| `NEXT_PUBLIC_APP_URL` | public | yes (prod) | Absolute app URL for auth links, e.g. `https://app.mjforestguru.com` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | public | no | Mapbox satellite tiles (domain-restricted token). Without it the app uses free OpenFreeMap / Esri tiles |
| `SUPABASE_SERVICE_ROLE_KEY` | server | yes | Invitations, integration secrets, Mapon sync, scripts |
| `MAPON_API_KEY` | server | no | Mapon API key. Overrides a key stored in the UI |
| `MAPON_API_URL` | server | no | Mapon base URL (default `https://mapon.com/api/v1`) |
| `CRON_SECRET` | server | for cron | Bearer token for `/api/cron/mapon` (≥ 16 chars, `openssl rand -hex 32`) |
| `RESEND_API_KEY` | server | no | In-app notification e-mails (auth e-mails go through Supabase SMTP) |
| `EMAIL_FROM` | server | no | Sender for notification e-mails |
| `RECEIPT_OCR_ENDPOINT` / `RECEIPT_OCR_TOKEN` | server | no | Optional receipt OCR provider |
| `ALLOW_DEMO_SEED` | scripts | no | Must be `true` for `seed:demo`. Never set it in production |
| `DATABASE_URL` | tests | no | Throw-away Postgres for the RLS test-suite |

## First run

1. **Create the owner** (no password is ever hard-coded):

   ```bash
   npm run setup:owner -- --email maris@example.com --name "Māris Bērziņš" \
     --company "MJ Forest" --slug mj-forest \
     --second-email julija@example.com --second-name "Jūlija …" --second-role owner
   ```

   The script sends the Latvian invite e-mail, creates the organization with `bootstrap_organization` (default roles and permissions, LV/SE/IS countries, lookups, safety templates) and adds the optional second owner or admin. If SMTP is not ready yet, add `--print-link` to print a one-time set-password link instead. The script is safe to re-run.
2. The owner opens the link, sets a password (≥ 10 characters) and signs in. The **setup wizard** guides through company settings → countries → first employees → machinery → first work site → Mapon (optional) → invitations, and ends with *"MJ FOREST GURU IS READY"*.
3. Further users: **Iestatījumi → Lietotāji un piekļuves → Uzaicināt lietotāju** (roles employee, foreman, manager, mechanic, admin; optionally linked to an existing employee record).

### Invitation flow

`inviteUser()` (`src/lib/invite.ts`) checks `manage_users` (plus `manage_permissions` for admin), then:

1. **New e-mail:** calls `auth.admin.inviteUserByEmail` with redirect `NEXT_PUBLIC_APP_URL/auth/confirm?next=/reset-password`, adds the membership through the service-role RPC `add_organization_member` (which creates or links the employee record), and writes an `invitations` row valid for 7 days.
2. **Existing account:** adds the membership only.
3. **Resend:** re-sends the invite, or a password-recovery e-mail if Supabase refuses, and extends the invitation by 7 days. **Revoke:** marks the invitation revoked and blocks the membership if the user never signed in.

## Demo data

For development and staging only. Demo data lives in a **separate organization** flagged `is_demo`. Every generated row has `is_demo = true` and shows a **DEMO** badge. The database refuses to seed any organization that is not a demo organization, and the RPC is callable only with the service role.

```bash
# the owner user must already exist (e.g. via setup:owner)
ALLOW_DEMO_SEED=true npm run seed:demo -- --owner-email you@example.com \
  --as foreman=f@example.com --as manager=m@example.com --as mechanic=k@example.com --as employee=e@example.com

# remove it completely (auth users are kept)
ALLOW_DEMO_SEED=true npm run seed:demo -- --remove
```

The dataset covers LV (5 employees / 3 machines / 2 sites), SE (8/5/3) and IS (4/3/2) with hours, fuel, expenses, repairs, tasks, production and alerts. Demo GPS positions are `source = manual`. They are never presented as Mapon data. The script refuses to run when `NEXT_PUBLIC_APP_URL` points to the production domain.

## Deployment

### Netlify

1. Import the Git repository in Netlify. `netlify.toml` sets `npm run build` and `.next`, and Netlify detects the Next.js runtime automatically.
2. Set all environment variables (Site configuration → Environment variables). Mark `SUPABASE_SERVICE_ROLE_KEY`, `MAPON_API_KEY`, `CRON_SECRET` and `RESEND_API_KEY` as **secret** and do not expose them to deploy previews you do not trust.
3. Set `NEXT_PUBLIC_APP_URL=https://app.mjforestguru.com` for production. `NEXT_PUBLIC_*` values are inlined at build time, so **redeploy** after changing them. The CSP is also generated at build time from `NEXT_PUBLIC_SUPABASE_URL`.

### Domain `app.mjforestguru.com`

1. Netlify → Domain management → Add domain `app.mjforestguru.com`.
2. At the DNS provider of `mjforestguru.com` add: `app  CNAME  <your-site>.netlify.app`. For `www`/apex, point to Netlify as well, or keep a separate site.
3. Wait for Netlify's automatic Let's Encrypt certificate and enable **Force HTTPS**.
4. In Supabase, set the Site URL / Redirect URLs to the production domain (see above).

## Mapon integration

* **Code:** `src/lib/integrations/mapon.ts` (server-only integration layer; the UI never calls Mapon directly).
* **Configure:** **Iestatījumi → Integrācijas → Mapon**. Paste the API key (stored in `integration_secrets` through the service role and never sent back to the browser; only `…last4` is shown), or set `MAPON_API_KEY` in the environment, which takes precedence. Then run **Pārbaudīt savienojumu** and **Sinhronizēt tagad**.
* **Data flow:** `GET {MAPON_API_URL}/unit/list.json?key=…&include[]=ignition&include[]=can` (10 s timeout) →
  * `mapon_devices` upsert (labels, VIN, plate, last position, mileage, engine hours, state)
  * unambiguous VIN / registration-number matches are linked to machines automatically, and you can link or unlink manually in the units table
  * for linked units: `gps_devices`, a new `gps_positions` row when Mapon reports a newer timestamp (`source = mapon_gps`, or `mapon_can` when engine hours come from CAN), and `machines.engine_hours` / `mileage_km` when they increased by ≥ 1
  * `integration_settings`: status, `last_sync_at`, `last_success_at`, device count, error code
* **Status:** 🟢 connected · 🟡 delayed (no successful sync for 2 h) · 🔴 error · ⚪ not configured.
* **Failure mode:** on errors the status becomes `error` with a short code (`unauthorized`, `timeout`, `unavailable`, `invalid_response`). The last known data is kept, the UI shows *"Mapon dati pašlaik nav pieejami."* with the last update time, and positions older than 1 h are never shown as live.
* **Units:** Mapon `mileage` is treated as **metres** and `ignition_total_time` as **seconds**. CAN values (odometer / engine hours) are preferred when present. Verify these against your Mapon account on the first sync.

### Scheduled sync (cron)

`/api/cron/mapon` syncs every organization with the Mapon integration enabled. It requires `Authorization: Bearer $CRON_SECRET` and returns counts only.

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.mjforestguru.com/api/cron/mapon
```

Schedule it every **5–15 minutes** with an external scheduler:

* **cron-job.org:** URL above, method GET, add the request header `Authorization: Bearer …`, every 10 minutes.
* **GitHub Actions:** a `schedule:` workflow running the curl above with the secret from repository secrets.
* **Netlify Scheduled Function** (optional): a small function with `schedule: "*/10 * * * *"` that `fetch`es the URL with the header.

> The route must be reachable without a user session: `src/middleware.ts` must treat `/api/cron/` as a public path. The route authenticates the request itself with the bearer token.

## Maps

MapLibre GL with free tiles by default: OpenFreeMap / CARTO dark basemap and Esri World Imagery for satellite. With `NEXT_PUBLIC_MAPBOX_TOKEN`, Mapbox satellite is used instead. If you add another tile provider, add its host to `TILE_HOSTS` in `next.config.ts` (CSP). Markers come strictly from database records. Machines without a GPS position are not placed on the map, and positions are never invented.

## PWA and offline behaviour

* Installable PWA (`src/app/manifest.ts`, icons in `public/icons`).
* The service worker (`public/sw.js`) caches **only immutable static assets** (`/_next/static`, icons, brand) and a neutral offline page. **HTML pages, API responses, Supabase requests and files are never cached**, so another person on the same device cannot read company data from the cache.
* Field actions (check-in/out, breaks, fuel, expenses, repairs, incidents, task status, production, photos) go to an **IndexedDB queue** (`src/lib/offline/queue.ts`) scoped to the signed-in user, with idempotency keys. They are flushed when the device is back online. Duplicates are ignored server-side.
* Pages are served with `Cache-Control: private, no-store`, and `/sw.js` is always revalidated.

## Testing

```bash
npm test                                   # all vitest suites (RLS suite is skipped without DATABASE_URL)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mjfg_test npm run test:db
```

`npm run test:db` recreates the throw-away database with `scripts/db-test-setup.sh` (a Supabase shim for plain Postgres plus all migrations) and runs `tests/rls`. It covers anonymous access, wrong-organization access, employee vs. restricted employee data, managers outside their scope, finance visibility, unauthorized updates and deletes, and private storage. **Never point `DATABASE_URL` at production:** the database is dropped and recreated.

Against a Supabase local stack use `supabase db reset` (it includes the real auth and storage schemas).

## Localization

The MVP ships Latvian (`src/i18n/lv.ts`). The `Dictionary` type enforces identical keys, so a new language is added by:

1. Copy `src/i18n/lv.ts` to `sv.ts`, `en.ts` or `is.ts`, translate the values, and export `export const sv: Dictionary = { … }`.
2. Register it in `src/i18n/index.ts` (`dictionaries = { lv, sv }`).
3. Mark it active in `ACTIVE_LANGUAGES` (`src/app/(app)/settings/constants.ts`) so it can be chosen as the organization default. Users' `profiles.locale` wins over the organization default.
4. Translate the e-mail templates in `supabase/templates/` if needed.

Dates, times and numbers use `Intl` with explicit IANA time zones (country → user → organization). Money is always shown per currency and never converted.

## Security checklist

Before going live, verify:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `MAPON_API_KEY` and `CRON_SECRET` are set **only** as server env vars, and no `NEXT_PUBLIC_` variable holds a secret
- [ ] `git ls-files | grep -E '\.env($|\.)'` lists only `.env.example`
- [ ] Migration 1100 applied (it fails if any public table lacks RLS). Run `npm run test:db` green
- [ ] Storage buckets `receipts`, `documents` and `media` are **private**
- [ ] Auth: public sign-up **disabled**, Site URL and Redirect URLs are the production domain, custom SMTP configured, Latvian templates installed
- [ ] Organization isolation, role permissions, and "employee cannot see finance / unrelated projects" verified with test users
- [ ] Audit log records logins, role/permission changes and edits (Audit Log page)
- [ ] Password reset, invitation (incl. expiry/revoke) and session expiration tested on the production domain
- [ ] HTTPS forced. Response headers include CSP, HSTS and `X-Frame-Options: DENY` (check with securityheaders.com)
- [ ] Mapon key stored server-side only (UI shows just `…last4`). `/api/cron/mapon` returns 401 without the bearer token
- [ ] No demo organization in production, and `ALLOW_DEMO_SEED` is unset
- [ ] At least two owners exist (the database prevents removing the last one)

## Backups and recovery

* **Database:** use Supabase daily backups (Pro plan) and enable **Point-in-Time Recovery** for production. Additionally run a scheduled off-site logical dump (`supabase db dump --data-only` / `pg_dump` with the direct connection string) to separate storage with encryption.
* **Schema:** the migrations in Git are the source of truth. Recover a new project by applying them in order, then restoring data.
* **Files are NOT covered by database backups.** Storage objects (receipts, documents, photos) must be backed up separately, for example with a scheduled job that uses the S3-compatible Storage API (`rclone` / `aws s3 sync` against the Supabase S3 endpoint) to a versioned bucket in another provider. `public.files` rows reference object paths, so restore both together.
* Soft-deleted records remain in the database (`deleted_at`) and can be restored. The audit log keeps old values for every change.
* Test a restore into a staging project at least quarterly.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Invitation e-mail never arrives | Default Supabase SMTP only sends to team members. Configure custom SMTP (Resend) and check Auth logs. Use `setup:owner --print-link` for the first owner |
| Invite link → login page with "Saite nav derīga" | Link already used or expired (Email OTP expiry). Use **Nosūtīt vēlreiz** in Lietotāji → Uzaicinājumi. Check that the template uses `{{ .TokenHash }}` and `/auth/confirm` |
| Redirect goes to localhost in production | `NEXT_PUBLIC_APP_URL` or the Supabase Site URL is wrong. Fix it and **redeploy** |
| "Uzaicinājumu sūtīšanai … SUPABASE_SERVICE_ROLE_KEY" | Service role key missing on the server |
| Map tiles or Supabase requests blocked in the console | CSP: rebuild after changing `NEXT_PUBLIC_SUPABASE_URL`, and add new tile hosts to `next.config.ts` |
| Mapon status "Kļūda: Mapon noraidīja API atslēgu" | Wrong or expired key, or `MAPON_API_KEY` in env overrides the stored key |
| Mapon status "Aizkavēts" | Cron not running: check the scheduler, `CRON_SECRET`, and that `/api/cron/mapon` is not redirected to `/login` by the middleware |
| `/api/cron/mapon` → 503 `cron_not_configured` | `CRON_SECRET` is not set (or is shorter than 16 characters) |
| "Organizācijai jāpaliek vismaz vienam īpašniekam" | Expected: the last owner cannot be demoted or disabled. Add another owner first |
| User signs in but sees "Jūsu kontam nav piekļuves" | Membership is disabled or missing. Check Lietotāji un piekļuves |
| `seed:demo` refuses to run | Set `ALLOW_DEMO_SEED=true`. Demo data is refused for the production URL and for non-demo organizations |
