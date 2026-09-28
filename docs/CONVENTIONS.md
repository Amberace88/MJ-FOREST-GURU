# MJ Forest Guru — code conventions

Stack: Next.js 15 App Router (server components by default), React 19, TypeScript strict, Tailwind v4,
Supabase (`@supabase/ssr`), zod v4, lucide-react. UI language: Latvian (all strings via i18n).

## Data access & security
- Pages and server actions get context with `const ctx = await requireOrg()` (`@/lib/context`).
  `ctx.supabase` is the **user-scoped** client — RLS enforces everything. Always also filter
  `.eq("organization_id", ctx.org.id)` and `.is("deleted_at", null)` where the table has it.
- UI gating: `ctx.can("perm")`, `ctx.canAny(...)`, page gating: `await requirePermission("perm", ...)`.
  Hiding UI is never security — the DB enforces with RLS/triggers.
- Service role (`createAdminClient()` from `@/lib/supabase/admin`) ONLY in server code, ONLY for
  things RLS cannot do (auth invites, integration secrets, cron). Check permission first; check
  `hasServiceRole()` (`@/lib/env.server`) and show `users.serviceKeyMissing` if absent.
- Never trust client ids blindly: include org filter; the DB also guards cross-org references.
- Schema: `supabase/migrations/*.sql`; generated types `src/lib/database.types.ts`.
  Embedded relations: `employee:employees(id, full_name)`; when a table has two FKs to the
  same table, disambiguate: `employees!repair_requests_assigned_mechanic_id_fkey(full_name)`.
- Soft delete (`deleted_at`) / archive (`archived_at`); never hard-delete business records.
- Money: `amount numeric` + `currency` (EUR/SEK/ISK). Never convert; aggregate per currency.
- Timestamps are UTC `timestamptz`; display with `fmtDate/fmtDateTime/fmtTime(value, tz)`
  from `@/lib/format`. `datetime-local` inputs → `localInputToUtc(local, tz)`; reverse
  `utcToLocalInput`. `todayIn(tz)`, `addDays(date, n)`, `zonedMidnightUtc(date, tz)`.

## Server actions
File `actions.ts` with `"use server"`. Signature for forms:
`export async function doThing(boundArg: string, _prev: ActionResult, fd: FormData): Promise<ActionResult>`
- Parse with `parseForm(zodSchema, fd)`, field builders `zf.*` (`@/lib/actions`).
- Errors: `return fail(ctx.t("errors.permission"))`, DB errors `return dbFail("scope.op", error)`.
- Success: `revalidatePath(...)`; `return { ok: true }` (or `redirect()` after create).
- Bind extra args in components: `action={doThing.bind(null, id) as FormAction}`.

## UI building blocks (reuse, don't reinvent)
- `@/components/ui/misc`: PageHeader (title, subtitle, actions, back, eyebrow), EmptyState,
  Avatar, Progress, Pagination, TabNav (`?tab=` pattern), SectionTitle, NoPermission, Kbd.
- `@/components/ui/card`: Card, CardHeader (title, subtitle, action, icon), CardBody, Stat, DefinitionList.
- `@/components/ui/badge`: Badge (tone, dot, pulse), DemoBadge. Tones via `statusTone`,
  `priorityTone`, `severityTone` (`@/lib/utils`).
- `@/components/ui/form` (client): Input, Select (options: `{value,label}[]`, `placeholder=""`
  adds empty option), Textarea, Checkbox, FormGrid, FormDialog (trigger ReactNode, title, action,
  size, defaultOpen — open with `?new=1`), ActionForm, ActionButton (one-click, `confirm`), SubmitButton.
- `@/components/ui/table`: DataTable (rows, columns[{key, header, cell, align, hideOnMobile}], rowKey, href, empty).
- `@/components/ui/filter-bar`: FilterBar (URL search-param filters: search/select/date).
- `@/components/ui/kpi`: KpiCard. Charts (lazy): `@/components/charts` AreaTrend, Bars, Lines, Donut.
- Map: `@/components/map` LiveMap; data `getMapData(ctx, {projectId?, countryId?})`.
- Shared: `@/components/shared/lists` (WorkLogTable, FuelTable, ExpenseTable, RepairTable, TaskTable,
  DocumentTable, expiryBucket, netHours), `comments` (Comments), `activity` (Activity – audit trail),
  `file-uploader` (FileUploader client – uploads to private bucket + registers `files` row),
  `file-gallery` (loadFiles + FileGallery with signed URLs).
- Options for selects: `getOptions(ctx)` (`@/lib/queries`) → projectOptions, machineOptions,
  employeeOptions, teamOptions, countryOptions, workTypes, fuelTypes, problemCategories, documentTypes.
- Search/pagination helpers: `likeTerm(q)` (sanitized ILIKE for `.or()`), `searchParamsToString`, `sp()`.
- Reference implementation: `src/app/(app)/projects/**` (list, detail with tabs, dialogs, actions).

## i18n
All UI text from `src/i18n/lv.ts` via `ctx.t("a.b")`, `ctx.label("group", key)` (server) or
`const { t, label } = useT()` (client, `@/i18n/client`). Add missing keys to the relevant
section of `lv.ts` (keys are type-checked). Never hardcode Latvian strings in components except
trivial punctuation.

## Design
Dark premium "forestry operations center": cards `.card`, `card-hover`, `topo-bg`, display font
`font-display` (uppercase headings), amber accent for primary signals, `tabular` for numbers,
`animate-fade-up` entry. Mobile-first: big touch targets, tables collapse (DataTable handles it).
