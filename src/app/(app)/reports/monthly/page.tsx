import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bars, Donut, DonutLegend } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requirePermission, type OrgContext } from "@/lib/context";
import { fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtMoneyMap, fmtNumber, todayIn } from "@/lib/format";
import { severityTone, sp as one, statusTone } from "@/lib/utils";
import { productionMap, utcRange } from "../../analytics/sections";
import { fetchAll } from "../../analytics/fetch-all";
import { monthEnd, num, numOrNull, resolveMonth, shiftMonth } from "../../analytics/period";
import { Delta, MiniTable } from "../../analytics/ui";
import { MonthPicker, PrintButton } from "./controls";

export const metadata: Metadata = { title: "Mēneša vadības atskaite" };

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden !important; }
  #mjfg-report, #mjfg-report * { visibility: visible !important; }
  #mjfg-report { position: absolute; left: 0; top: 0; width: 100%; }
  #mjfg-report section { break-inside: avoid-page; }
}`;

type ChartRow = Record<string, string | number | null>;

export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("export_reports", "view_analytics");
  const sp = await searchParams;
  const tz = ctx.settings?.default_timezone ?? ctx.timezone;
  const m = resolveMonth(one(sp.month), tz);
  const prevFrom = shiftMonth(m.from, -1);
  const prevTo = monthEnd(prevFrom);
  const country = ctx.countryId ?? undefined;
  const org = ctx.org.id;
  const sb = ctx.supabase;
  const { fromUtc, toUtc } = utcRange(m.from, m.to, tz);

  const [hours, prevHours, projects, machines, expenses, prevExpenses, fuel, prevFuel, fuelLogs, repairs, incidents, employees] = await Promise.all([
    sb.rpc("analytics_hours_by_employee", { p_org: org, p_from: m.from, p_to: m.to, p_country: country }),
    sb.rpc("analytics_hours_by_employee", { p_org: org, p_from: prevFrom, p_to: prevTo, p_country: country }),
    sb.rpc("analytics_project_summary", { p_org: org, p_from: m.from, p_to: m.to, p_country: country }),
    sb.rpc("analytics_machine_costs", { p_org: org, p_from: m.from, p_to: m.to, p_country: country }),
    sb.rpc("analytics_expenses_by_category", { p_org: org, p_from: m.from, p_to: m.to, p_country: country }),
    sb.rpc("analytics_expenses_by_category", { p_org: org, p_from: prevFrom, p_to: prevTo, p_country: country }),
    sb.rpc("analytics_fuel_summary", { p_org: org, p_from: m.from, p_to: m.to, p_country: country }),
    sb.rpc("analytics_fuel_summary", { p_org: org, p_from: prevFrom, p_to: prevTo, p_country: country }),
    fetchAll((a, b) => {
      let q = sb.from("fuel_logs").select("total_amount, currency").eq("organization_id", org).is("deleted_at", null)
        .gte("occurred_at", fromUtc).lt("occurred_at", toUtc);
      if (country) q = q.eq("country_id", country);
      return q.order("id").range(a, b);
    }),
    sb.from("repair_requests").select("id, created_at, title, status, priority, labour_cost, external_cost, currency, downtime_hours, machine:machines(name, country_id)")
      .eq("organization_id", org).is("deleted_at", null).gte("created_at", fromUtc).lt("created_at", toUtc).order("created_at").limit(300),
    sb.from("incidents").select("id, occurred_at, title, incident_type, severity, status, project:projects(code, country_id)")
      .eq("organization_id", org).is("deleted_at", null).gte("occurred_at", fromUtc).lt("occurred_at", toUtc).order("occurred_at").limit(300),
    (() => {
      let q = sb.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", org).is("deleted_at", null).is("archived_at", null).eq("status", "active");
      if (country) q = q.eq("country_id", country);
      return q;
    })(),
  ]);

  const hourRows = (hours.data ?? []).filter((r) => num(r.total_hours) > 0);
  const totalHours = hourRows.reduce((a, r) => a + num(r.total_hours), 0);
  const prevTotalHours = (prevHours.data ?? []).reduce((a, r) => a + num(r.total_hours), 0);
  const overtime = hourRows.reduce((a, r) => a + num(r.overtime_hours), 0);
  const projectRows = (projects.data ?? []).filter((p) => num(p.hours) > 0 || num(p.fuel_litres) > 0 || num(p.expenses) > 0 || Object.keys(productionMap(p.production)).length > 0);
  const m3 = projectRows.reduce((a, p) => a + (productionMap(p.production).m3 ?? 0), 0);
  const machineRows = (machines.data ?? []).filter((r) => num(r.work_hours) > 0 || num(r.fuel_litres) > 0 || num(r.total_cost) > 0);
  const fs = fuel.data?.[0];
  const pfs = prevFuel.data?.[0];
  const fuelByCur: Record<string, number> = {};
  for (const f of fuelLogs.rows) if (f.total_amount != null) fuelByCur[f.currency] = (fuelByCur[f.currency] ?? 0) + num(f.total_amount);
  const expByCur: Record<string, number> = {};
  for (const e of expenses.data ?? []) expByCur[e.currency] = (expByCur[e.currency] ?? 0) + num(e.total);
  const prevExpByCur: Record<string, number> = {};
  for (const e of prevExpenses.data ?? []) prevExpByCur[e.currency] = (prevExpByCur[e.currency] ?? 0) + num(e.total);
  const repairRows = (repairs.data ?? []).filter((r) => !country || (r.machine as { country_id: string | null } | null)?.country_id === country);
  const incidentRows = (incidents.data ?? []).filter((r) => { const p = r.project as { country_id: string | null } | null; return !country || !p || p.country_id === country; });
  const coverage = await safetyCoverage(ctx, country ?? null);

  const monthName = new Intl.DateTimeFormat("lv-LV", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m.from}T12:00:00Z`));
  const empChart: ChartRow[] = hourRows.slice(0, 15).map((r) => ({ name: (r.full_name ?? "—").slice(0, 22), hours: num(r.total_hours) }));
  const expEur = (expenses.data ?? []).filter((e) => e.currency === "EUR").map((e) => ({ name: ctx.label("expenses.categories", e.category), value: num(e.total) }));
  const generatedBy = ctx.employee?.full_name ?? ctx.profile?.full_name ?? ctx.user.email ?? "";

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="mb-6 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <MonthPicker value={m.month} max={todayIn(tz).slice(0, 7)} />
        <PrintButton />
      </div>

      <div id="mjfg-report" className="space-y-6 print:space-y-4">
        {/* Cover */}
        <header className="card topo-bg overflow-hidden p-6 print:border-0 print:p-0">
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted">{ctx.t("brand.name")} · {ctx.org.name}</div>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-wide md:text-5xl">{monthName}</h1>
          <p className="mt-2 text-sm text-muted">
            {ctx.t("reports.monthly")} · {fmtDate(m.from)} – {fmtDate(m.to)}
            {ctx.country ? ` · ${ctx.country.flag ?? ""} ${ctx.country.name}` : ` · ${ctx.t("reports.countryAll")}`}
          </p>
          <p className="mt-1 text-xs text-faint">{ctx.t("reports.generated")}: {fmtDateTime(new Date(), tz)} · {ctx.t("reports.generatedBy")}: {generatedBy}</p>
        </header>

        {/* Summary KPIs */}
        <Section title={ctx.t("reports.summary")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={ctx.t("analytics.employees")} value={fmtNumber(hourRows.length)} sub={`${employees.count ?? 0} ${ctx.t("employees.status.active").toLowerCase()}`} />
            <Kpi label={ctx.t("analytics.totalHours")} value={fmtHours(totalHours)} sub={<Delta current={totalHours} previous={prevTotalHours} label={ctx.t("analytics.vsPrevious")} />} />
            <Kpi label={ctx.t("analytics.overtime")} value={fmtHours(overtime)} />
            <Kpi label={ctx.t("nav.projects")} value={fmtNumber(projectRows.filter((p) => num(p.hours) > 0).length)} />
            <Kpi label={ctx.t("analytics.machines")} value={fmtNumber(machineRows.length)} sub={`${fmtHours(machineRows.reduce((a, r) => a + num(r.work_hours), 0))}`} />
            <Kpi label={ctx.t("nav.fuel")} value={fs && num(fs.litres) > 0 ? `${fmtNumber(fs.litres)} L` : ctx.t("common.noData")}
              sub={<>{fmtMoneyMap(fuelByCur) ?? "—"} <Delta current={numOrNull(fs?.litres)} previous={numOrNull(pfs?.litres)} invert /></>} />
            <Kpi label={ctx.t("analytics.expenses")} value={fmtMoneyMap(expByCur) ?? "—"}
              sub={<Delta current={expByCur.EUR} previous={prevExpByCur.EUR} invert label={ctx.t("analytics.vsPrevious")} />} />
            <Kpi label={ctx.t("analytics.production")} value={m3 > 0 ? `${fmtNumber(m3, 1)} m³` : ctx.t("common.noData")}
              sub={m3 > 0 && totalHours > 0 ? `${fmtNumber(m3 / totalHours, 2)} ${ctx.t("analytics.m3PerHour")}` : undefined} />
            <Kpi label={ctx.t("analytics.repairs")} value={fmtNumber(repairRows.length)} />
            <Kpi label={ctx.t("incidents.title")} value={fmtNumber(incidentRows.length)}
              sub={incidentRows.filter((i) => ["high", "critical"].includes(i.severity)).length ? `${incidentRows.filter((i) => ["high", "critical"].includes(i.severity)).length} ${ctx.t("incidents.seriousCount").toLowerCase()}` : undefined} />
            <Kpi label={ctx.t("safety.coverage")} value={coverage.overall === null ? "—" : `${Math.round(coverage.overall)} %`} />
          </div>
        </Section>

        {/* Hours per employee */}
        <Section title={ctx.t("reports.hoursPerEmployee")}>
          {hourRows.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Bars data={empChart} x="name" horizontal unit="h" height={Math.max(160, empChart.length * 26 + 40)} series={[{ key: "hours", label: ctx.t("hours.total") }]} />
              <MiniTable head={[{ label: ctx.t("common.employee") }, { label: ctx.t("hours.total"), align: "right" }, { label: ctx.t("hours.overtime"), align: "right" }, { label: ctx.t("hours.daysWorked"), align: "right" }]}
                rows={hourRows.map((r) => [r.full_name, fmtHours(r.total_hours), num(r.overtime_hours) > 0 ? fmtHours(r.overtime_hours) : "—", fmtNumber(r.days_worked)])} />
            </div>
          ) : <Empty ctx={ctx} />}
        </Section>

        {/* Projects */}
        <Section title={ctx.t("reports.perProject")}>
          <MiniTable empty={ctx.t("common.noData")}
            head={[{ label: ctx.t("common.project") }, { label: ctx.t("hours.total"), align: "right" }, { label: ctx.t("analytics.workers"), align: "right" },
              { label: ctx.t("analytics.litres"), align: "right" }, { label: ctx.t("analytics.expenses"), align: "right" }, { label: ctx.t("analytics.production"), align: "right" },
              { label: ctx.t("analytics.productivity"), align: "right" }]}
            rows={projectRows.map((p) => {
              const prod = productionMap(p.production);
              return [
                <span key="p"><strong className="font-semibold">{p.code}</strong> <span className="text-muted">{p.name}</span></span>,
                fmtHours(p.hours), fmtNumber(p.workers), numOrNull(p.fuel_litres) != null ? fmtNumber(p.fuel_litres, 1) : "—",
                numOrNull(p.expenses) != null ? fmtMoney(p.expenses, "EUR") : "—",
                Object.entries(prod).map(([u, q]) => `${fmtNumber(q, 1)} ${ctx.label("production.units", u)}`).join(" · ") || "—",
                prod.m3 && num(p.hours) > 0 ? `${fmtNumber(prod.m3 / num(p.hours), 2)} ${ctx.t("analytics.m3PerHour")}` : ctx.t("common.notEnoughData"),
              ];
            })} />
        </Section>

        {/* Machines */}
        <Section title={ctx.t("reports.machinesSection")}>
          <MiniTable empty={ctx.t("common.noData")}
            head={[{ label: ctx.t("common.machine") }, { label: ctx.t("analytics.operatingHours"), align: "right" }, { label: ctx.t("analytics.litres"), align: "right" },
              { label: ctx.t("analytics.fuelCost"), align: "right" }, { label: ctx.t("analytics.repairCost"), align: "right" }, { label: ctx.t("analytics.totalOperatingCost"), align: "right" },
              { label: ctx.t("analytics.costPerHour"), align: "right" }, { label: ctx.t("analytics.downtime"), align: "right" }]}
            rows={machineRows.map((r) => [r.name, fmtHours(r.work_hours), numOrNull(r.fuel_litres) != null ? fmtNumber(r.fuel_litres, 1) : "—",
              numOrNull(r.fuel_cost) != null ? fmtMoney(r.fuel_cost, "EUR") : "—", numOrNull(r.repair_cost) != null ? fmtMoney(r.repair_cost, "EUR") : "—",
              numOrNull(r.total_cost) != null ? fmtMoney(r.total_cost, "EUR") : "—", numOrNull(r.cost_per_hour) != null ? fmtMoney(r.cost_per_hour, "EUR") : "—",
              numOrNull(r.downtime_hours) != null ? `${fmtNumber(r.downtime_hours, 1)} h` : "—"])} />
          {fs && (
            <p className="mt-3 text-xs text-muted">
              {ctx.t("analytics.avgPrice")}: {numOrNull(fs.avg_price_eur) != null ? `${fmtNumber(fs.avg_price_eur, 3)} €/L` : "—"} ·{" "}
              {ctx.t("analytics.litresPerHour")}: {numOrNull(fs.litres_per_hour) != null ? fmtNumber(fs.litres_per_hour, 2) : ctx.t("common.notEnoughData")}
            </p>
          )}
        </Section>

        {/* Expenses */}
        <Section title={ctx.t("reports.expensesSection")}>
          {(expenses.data ?? []).length ? (
            <div className="grid items-center gap-4 lg:grid-cols-[1fr_1.4fr]">
              {expEur.length > 0 ? (
                <div className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Donut data={expEur} unit="EUR" height={180} />
                  <DonutLegend data={expEur} unit="€" />
                </div>
              ) : <div />}
              <MiniTable head={[{ label: ctx.t("common.category") }, { label: ctx.t("common.currency") }, { label: ctx.t("analytics.count"), align: "right" }, { label: ctx.t("common.total"), align: "right" }]}
                rows={[...(expenses.data ?? [])].sort((a, b) => a.currency.localeCompare(b.currency) || num(b.total) - num(a.total))
                  .map((e) => [ctx.label("expenses.categories", e.category), e.currency, fmtNumber(e.count), fmtMoney(e.total, e.currency)])} />
            </div>
          ) : <Empty ctx={ctx} />}
          <p className="mt-3 text-xs text-faint">{ctx.t("analytics.currencyNote")}</p>
        </Section>

        {/* Repairs */}
        <Section title={ctx.t("reports.repairsSection")}>
          <MiniTable empty={ctx.t("common.noData")}
            head={[{ label: ctx.t("common.date") }, { label: ctx.t("common.machine") }, { label: ctx.t("repairs.titleLabel") }, { label: ctx.t("common.status") },
              { label: ctx.t("repairs.totalCost"), align: "right" }, { label: ctx.t("repairs.downtime"), align: "right" }]}
            rows={repairRows.map((r) => {
              const cost = num(r.labour_cost) + num(r.external_cost);
              return [fmtDate(r.created_at, tz), (r.machine as { name: string } | null)?.name ?? "—", r.title,
                <Badge key="s" tone={statusTone(r.status)}>{ctx.label("repairs.status", r.status)}</Badge>,
                cost > 0 ? fmtMoney(cost, r.currency) : "—", numOrNull(r.downtime_hours) != null ? fmtNumber(r.downtime_hours, 1) : "—"];
            })} />
        </Section>

        {/* Incidents */}
        <Section title={ctx.t("reports.incidentsSection")}>
          <MiniTable empty={ctx.t("incidents.empty")}
            head={[{ label: ctx.t("incidents.occurredAt") }, { label: ctx.t("incidents.titleLabel") }, { label: ctx.t("incidents.typeLabel") },
              { label: ctx.t("incidents.severityLabel") }, { label: ctx.t("common.status") }]}
            rows={incidentRows.map((i) => [fmtDateTime(i.occurred_at, tz), i.title, ctx.label("incidents.type", i.incident_type),
              <Badge key="sev" tone={severityTone(i.severity)}>{ctx.label("incidents.severity", i.severity)}</Badge>,
              <Badge key="st" tone={statusTone(i.status)}>{ctx.label("incidents.status", i.status)}</Badge>])} />
        </Section>

        {/* Safety coverage */}
        <Section title={ctx.t("reports.safetySection")}>
          {coverage.rules.length ? (
            <ul className="space-y-3">
              {coverage.rules.map((r) => (
                <li key={r.id} className="break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{r.title} <span className="text-xs text-muted">· {ctx.label("safety.sections", r.section)} · v{r.version}</span></span>
                    <span className="shrink-0 tabular text-muted">{r.acked} / {r.total} · <strong className="text-ink">{r.pct === null ? "—" : `${Math.round(r.pct)} %`}</strong></span>
                  </div>
                  <Progress className="mt-1" value={r.pct ?? 0} tone={r.pct === 100 ? "forest" : r.pct !== null && r.pct < 60 ? "crit" : "amber"} />
                </li>
              ))}
            </ul>
          ) : <Empty ctx={ctx} />}
        </Section>

        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-faint">{ctx.t("brand.name")} · {ctx.t("brand.footer")}</p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Card className="print:border-0">
        <CardHeader title={title} />
        <CardBody>{children}</CardBody>
      </Card>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 truncate font-display text-2xl font-bold tabular text-ink">{value}</div>
      {sub && <div className="mt-0.5 flex flex-wrap items-center gap-1 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Empty({ ctx }: { ctx: OrgContext }) {
  return <p className="text-sm text-muted">{ctx.t("common.noData")}</p>;
}

async function safetyCoverage(ctx: OrgContext, country: string | null) {
  const sb = ctx.supabase;
  const { data: rulesData } = await sb.from("safety_rules").select("id, section, title, country_id, current_version, sort_order")
    .eq("organization_id", ctx.org.id).eq("is_active", true).eq("requires_acknowledgement", true).order("section").order("sort_order");
  const rules = (rulesData ?? []).filter((r) => !country || !r.country_id || r.country_id === country);
  if (!rules.length) return { overall: null as number | null, rules: [] as { id: string; title: string; section: string; version: number; acked: number; total: number; pct: number | null }[] };
  let eq = sb.from("employees").select("id, country_id").eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null)
    .eq("status", "active").not("user_id", "is", null);
  if (country) eq = eq.eq("country_id", country);
  const [emps, vers] = await Promise.all([eq, sb.from("safety_rule_versions").select("id, rule_id, version").in("rule_id", rules.map((r) => r.id))]);
  const vid = new Map(rules.map((r) => [r.id, (vers.data ?? []).find((v) => v.rule_id === r.id && v.version === r.current_version)?.id]));
  const ids = [...vid.values()].filter((x): x is string => Boolean(x));
  const acks = ids.length
    ? (await fetchAll((a, b) => sb.from("safety_acknowledgements").select("rule_version_id, employee_id").in("rule_version_id", ids).order("id").range(a, b), 100_000)).rows
    : [];
  const set = new Set(acks.map((a) => `${a.rule_version_id}:${a.employee_id}`));
  let totA = 0, totT = 0;
  const out = rules.map((r) => {
    const applicable = (emps.data ?? []).filter((e) => !r.country_id || e.country_id === r.country_id);
    const acked = applicable.filter((e) => set.has(`${vid.get(r.id)}:${e.id}`)).length;
    totA += acked; totT += applicable.length;
    return { id: r.id, title: r.title, section: r.section, version: r.current_version, acked, total: applicable.length, pct: applicable.length ? (acked / applicable.length) * 100 : null };
  });
  return { overall: totT ? (totA / totT) * 100 : null, rules: out };
}
