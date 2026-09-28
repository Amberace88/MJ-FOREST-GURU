import type { Metadata } from "next";
import { Boxes, CalendarDays, Clock, Tractor, Trash2, Trees } from "lucide-react";
import Link from "next/link";
import { Bars } from "@/components/charts";
import { netHours, type WorkLogRow } from "@/components/shared/lists";
import { DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { ActionButton } from "@/components/ui/form";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg, type OrgContext } from "@/lib/context";
import { addDays, fmtDate, fmtNumber, fmtShortDate, todayIn, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { searchParamsToString, sp as one } from "@/lib/utils";
import { archiveProduction } from "./actions";
import { NewProductionDialog, type ProductionFormOptions } from "./components";

export const metadata: Metadata = { title: "Produkcija" };

type SP = Record<string, string | string[] | undefined>;
const UNITS = ["m3", "units", "loads", "other"] as const;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 50;
const MAX_ROWS = 3000;
const COLORS = ["#c09a6b", "#7fa6c9", "#5a9866", "#e2a23b", "#9d8fd1", "#6fb3a8"];

type ProdRow = {
  id: string; production_date: string; quantity: number; unit: string; unit_label: string | null; work_type: string | null; notes: string | null;
  project_id: string; machine_id: string | null; created_by: string | null; is_demo: boolean;
  project: { id: string; code: string } | null; work_site: { name: string } | null; employee: { id: string; full_name: string } | null;
  team: { name: string } | null; machine: { id: string; name: string } | null;
};

export default async function ProductionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const today = todayIn(ctx.timezone);
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const project = UUID_RE.test(one(sp.project) ?? "") ? one(sp.project)! : null;
  const employee = UUID_RE.test(one(sp.employee) ?? "") ? one(sp.employee)! : null;
  const machine = UUID_RE.test(one(sp.machine) ?? "") ? one(sp.machine)! : null;
  const unit = (UNITS as readonly string[]).includes(one(sp.unit) ?? "") ? one(sp.unit)! : null;
  const country = UUID_RE.test(one(sp.country) ?? "") ? one(sp.country)! : ctx.countryId;
  const explicitRange = DATE_RE.test(one(sp.from) ?? "") || DATE_RE.test(one(sp.to) ?? "");
  const to = DATE_RE.test(one(sp.to) ?? "") ? one(sp.to)! : today;
  const from = DATE_RE.test(one(sp.from) ?? "") ? one(sp.from)! : addDays(to, -29);

  const opts = await getOptions(ctx);
  // production_logs has no country column: filter through the country's projects
  const countryProjectIds = country ? opts.projects.filter((p) => p.country_id === country).map((p) => p.id) : null;

  let q = ctx.supabase.from("production_logs")
    .select("id, production_date, quantity, unit, unit_label, work_type, notes, project_id, machine_id, created_by, is_demo, project:projects(id, code), work_site:work_sites(name), employee:employees(id, full_name), team:teams(name), machine:machines(id, name)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .gte("production_date", from).lte("production_date", to)
    .order("production_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (project) q = q.eq("project_id", project);
  if (employee) q = q.eq("employee_id", employee);
  if (machine) q = q.eq("machine_id", machine);
  if (unit) q = q.eq("unit", unit);
  if (countryProjectIds) q = q.in("project_id", countryProjectIds.length ? countryProjectIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data }, sitesRes] = await Promise.all([
    q,
    ctx.supabase.from("work_sites").select("id, name, project_id").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
  ]);
  const rows = (data ?? []) as unknown as ProdRow[];
  const truncated = rows.length >= MAX_ROWS;

  // ---- totals per unit (m³, gab., kravas, custom "other" labels are kept apart — never summed across units)
  const unitKey = (r: ProdRow) => (r.unit === "other" ? `other:${(r.unit_label ?? "").trim().toLowerCase()}` : r.unit);
  const unitName = (r: ProdRow) => (r.unit === "other" ? (r.unit_label ?? ctx.label("production.units", "other")) : ctx.label("production.units", r.unit));
  const groups = new Map<string, { name: string; total: number; rows: ProdRow[] }>();
  for (const r of rows) {
    const k = unitKey(r);
    const g = groups.get(k) ?? { name: unitName(r), total: 0, rows: [] };
    g.total += Number(r.quantity);
    g.rows.push(r);
    groups.set(k, g);
  }
  const unitGroups = [...groups.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);

  const productivity = ctx.can("view_employee_hours") && rows.length ? await productivityFor(ctx, rows, from, to, unitGroups.map(([k, g]) => ({ key: k, rows: g.rows }))) : null;

  // ---- chart by day (series per unit)
  const series = unitGroups.slice(0, COLORS.length).map(([k, g], i) => ({ key: `u${i}`, unitKey: k, label: g.name, color: COLORS[i] }));
  const days: string[] = [];
  const span = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
  if (span >= 0 && span <= 92) for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  else days.push(...[...new Set(rows.map((r) => r.production_date))].sort());
  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const s = series.find((x) => x.unitKey === unitKey(r));
    if (!s) continue;
    const m = byDay.get(r.production_date) ?? {};
    m[s.key] = (m[s.key] ?? 0) + Number(r.quantity);
    byDay.set(r.production_date, m);
  }
  const chartData = days.map((d) => ({ day: fmtShortDate(d), ...Object.fromEntries(series.map((s) => [s.key, Math.round((byDay.get(d)?.[s.key] ?? 0) * 100) / 100])) }));

  // ---- form options
  const canCreate = opts.projectOptions.length > 0;
  const formOptions: ProductionFormOptions = {
    projects: opts.projectOptions, machines: opts.machineOptions, employees: opts.employeeOptions, teams: opts.teamOptions, workTypes: opts.workTypes,
    sites: sitesRes.data ?? [],
  };
  const seesOthers = ctx.canAny("view_all_projects", "view_team", "view_employee_hours");
  const filters: FilterDef[] = [
    { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
    ...(seesOthers ? [{ type: "select" as const, name: "employee", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
    { type: "select", name: "machine", label: ctx.t("common.machine"), options: opts.machineOptions },
    { type: "select", name: "unit", label: ctx.t("production.unit"), options: UNITS.map((u) => ({ value: u, label: ctx.label("production.units", u) })) },
    ...(ctx.countryId ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: opts.countryOptions }]),
    { type: "date", name: "from", label: ctx.t("common.from") },
    { type: "date", name: "to", label: ctx.t("common.to") },
  ];
  const canArchiveAny = ctx.can("manage_projects");
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const workDays = new Set(rows.map((r) => r.production_date)).size;

  return (
    <>
      <PageHeader title={ctx.t("production.title")} subtitle={ctx.t("production.subtitle")}
        eyebrow={<span>{fmtDate(from)} – {fmtDate(to)}{!explicitRange && ` · ${ctx.t("production.last30")}`}</span>}
        actions={canCreate && (
          <NewProductionDialog options={formOptions} today={today} canPickEmployee={ctx.canAny("manage_projects", "view_team", "edit_employee_hours")}
            defaultEmployeeId={ctx.employee?.id ?? null} defaultProjectId={project ?? undefined} defaultOpen={one(sp.new) === "1"} />
        )} />
      <FilterBar filters={filters} />

      <section aria-label={ctx.t("production.totals")} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {unitGroups.length === 0 && (
          <KpiCard label={ctx.t("production.title")} value={null} noData={ctx.t("common.noData")} icon={<Boxes className="h-4 w-4" />} />
        )}
        {unitGroups.slice(0, 4).map(([k, g], i) => {
          const p = productivity?.get(k);
          return (
            <KpiCard key={k} label={g.name} value={g.total} decimals={g.total % 1 ? 1 : 0} suffix={g.name} delay={i * 40}
              tone={i === 0 ? "wood" : i === 1 ? "info" : "forest"} icon={<Trees className="h-4 w-4" />}
              sub={p ? (
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.perHour != null ? `${fmtNumber(p.perHour, 2)} ${g.name} ${ctx.t("production.perHour")}` : ctx.t("common.notEnoughData")}</span>
                  <span className="flex items-center gap-1"><Tractor className="h-3 w-3" />{p.perMachineHour != null ? `${fmtNumber(p.perMachineHour, 2)} ${g.name} ${ctx.t("production.perMachineHour")}` : ctx.t("common.notEnoughData")}</span>
                </span>
              ) : `${g.rows.length} ${ctx.t("production.entries")}`} />
          );
        })}
        {unitGroups.length > 0 && unitGroups.length < 4 && (
          <KpiCard label={ctx.t("production.activeDays")} value={workDays} icon={<CalendarDays className="h-4 w-4" />} tone="amber" delay={160}
            sub={`${rows.length} ${ctx.t("production.entries")}`} />
        )}
      </section>
      {!ctx.can("view_employee_hours") && rows.length > 0 && <p className="-mt-3 mb-5 text-xs text-faint">{ctx.t("production.productivityHidden")}</p>}

      {rows.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={ctx.t("production.byDay")} subtitle={series.map((s) => s.label).join(" · ")} />
          <CardBody><Bars data={chartData} x="day" series={series.map(({ key, label, color }) => ({ key, label, color }))} height={240} /></CardBody>
        </Card>
      )}

      <DataTable rows={pageRows} rowKey={(r) => r.id}
        empty={<EmptyState icon={<Trees className="h-6 w-6" />} title={ctx.t("production.empty")} text={ctx.t("production.emptyHint")}
          action={canCreate ? <NewProductionDialog options={formOptions} today={today} canPickEmployee={ctx.canAny("manage_projects", "view_team", "edit_employee_hours")} defaultEmployeeId={ctx.employee?.id ?? null} /> : undefined} />}
        columns={[
          { key: "d", header: ctx.t("common.date"), cell: (r) => <span className="flex items-center gap-2">{fmtDate(r.production_date)}{r.is_demo && <DemoBadge />}</span> },
          { key: "p", header: ctx.t("common.project"), cell: (r) => r.project ? <Link href={`/projects/${r.project.id}?tab=production`} className="hover:text-amber">{r.project.code}</Link> : "—" },
          { key: "s", header: ctx.t("production.workSite"), cell: (r) => r.work_site?.name ?? "—", hideOnMobile: true },
          { key: "e", header: ctx.t("common.employee"), cell: (r) => r.employee?.full_name ?? r.team?.name ?? "—" },
          { key: "m", header: ctx.t("common.machine"), cell: (r) => r.machine ? <Link href={`/machines/${r.machine.id}`} className="hover:text-amber">{r.machine.name}</Link> : "—", hideOnMobile: true },
          { key: "w", header: ctx.t("hours.workType"), cell: (r) => r.work_type ?? "—", hideOnMobile: true },
          { key: "q", header: ctx.t("production.quantity"), align: "right", cell: (r) => <span className="font-semibold">{fmtNumber(r.quantity, Number(r.quantity) % 1 ? 2 : 0)} {unitName(r)}</span> },
          { key: "n", header: ctx.t("common.notes"), cell: (r) => <span className="line-clamp-1 max-w-[220px] text-muted" title={r.notes ?? undefined}>{r.notes ?? "—"}</span>, hideOnMobile: true },
          { key: "a", header: "", align: "right", hideOnMobile: true, cell: (r) => (r.created_by === ctx.user.id || canArchiveAny) ? (
            <ActionButton action={archiveProduction.bind(null, r.id)} variant="ghost" size="xs" confirm={`${ctx.t("common.delete")}?`}>
              <Trash2 className="h-3.5 w-3.5" /><span className="sr-only">{ctx.t("common.delete")}</span>
            </ActionButton>
          ) : null },
        ]} />
      <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(p) => `/production${searchParamsToString(sp, { page: String(p), new: null })}`} />
      {truncated && <p className="mt-2 text-xs text-warn">{ctx.t("production.truncated", { n: MAX_ROWS })}</p>}
    </>
  );
}

/**
 * Productivity per unit where it is computable — never a misleading number:
 *  - per work hour: quantity on (project, day) pairs that have logged work hours ÷ those hours
 *  - per machine hour: quantity with a machine on (machine, day) pairs that have machine hours ÷ those hours
 * Returns null ratios when the matching hours are missing ("Nav pietiekamu datu").
 */
async function productivityFor(ctx: OrgContext, rows: ProdRow[], from: string, to: string, groups: { key: string; rows: ProdRow[] }[]) {
  const projectIds = [...new Set(rows.map((r) => r.project_id))];
  const { data } = await ctx.supabase.from("work_logs")
    .select("id, started_at, ended_at, status, work_type, source, project_id, machine_id, breaks:work_breaks(started_at, ended_at)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).not("ended_at", "is", null)
    .in("project_id", projectIds)
    .gte("started_at", zonedMidnightUtc(from, ctx.timezone).toISOString())
    .lt("started_at", zonedMidnightUtc(addDays(to, 1), ctx.timezone).toISOString())
    .limit(10000);
  const logs = (data ?? []) as unknown as (WorkLogRow & { project_id: string | null; machine_id: string | null })[];
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const projectDay = new Map<string, number>();
  const machineDay = new Map<string, number>();
  for (const l of logs) {
    const h = netHours(l);
    if (h <= 0) continue;
    const day = dayOf.format(new Date(l.started_at));
    if (l.project_id) projectDay.set(`${l.project_id}|${day}`, (projectDay.get(`${l.project_id}|${day}`) ?? 0) + h);
    if (l.machine_id) machineDay.set(`${l.machine_id}|${day}`, (machineDay.get(`${l.machine_id}|${day}`) ?? 0) + h);
  }
  const out = new Map<string, { perHour: number | null; perMachineHour: number | null }>();
  for (const g of groups) {
    let qWork = 0, qMach = 0;
    const workKeys = new Set<string>(), machKeys = new Set<string>();
    for (const r of g.rows) {
      const pk = `${r.project_id}|${r.production_date}`;
      if (projectDay.has(pk)) { qWork += Number(r.quantity); workKeys.add(pk); }
      if (r.machine_id) {
        const mk = `${r.machine_id}|${r.production_date}`;
        if (machineDay.has(mk)) { qMach += Number(r.quantity); machKeys.add(mk); }
      }
    }
    const hWork = [...workKeys].reduce((a, k) => a + (projectDay.get(k) ?? 0), 0);
    const hMach = [...machKeys].reduce((a, k) => a + (machineDay.get(k) ?? 0), 0);
    out.set(g.key, {
      perHour: hWork >= 0.25 && qWork > 0 ? qWork / hWork : null,
      perMachineHour: hMach >= 0.25 && qMach > 0 ? qMach / hMach : null,
    });
  }
  return out;
}
