import { BarChart3, CheckCircle2, Clock, Fuel, Globe2, TreePine, Tractor, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { AreaTrend, Bars, Donut, DonutLegend } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Progress, SectionTitle } from "@/components/ui/misc";
import type { Json } from "@/lib/database.types";
import type { OrgContext } from "@/lib/context";
import { addDays, fmtHours, fmtMoney, fmtNumber, fmtShortDate, todayIn, zonedMidnightUtc } from "@/lib/format";
import { statusTone } from "@/lib/utils";
import { fetchAll } from "./fetch-all";
import { num, numOrNull, type Period } from "./period";
import { Delta, Metric, MiniTable } from "./ui";

export type TabProps = { ctx: OrgContext; period: Period; tz: string; country?: string };
type ChartRow = Record<string, string | number | null>;

const short = (s: string | null | undefined, n = 22) => (!s ? "—" : s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function utcRange(from: string, to: string, tz: string) {
  return { fromUtc: zonedMidnightUtc(from, tz).toISOString(), toUtc: zonedMidnightUtc(addDays(to, 1), tz).toISOString() };
}

export function productionMap(v: Json | null | undefined): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v)) { const n = Number(x); if (Number.isFinite(n)) out[k] = n; }
  return out;
}

function countryLabel(ctx: OrgContext, id: string | null | undefined) {
  const c = ctx.countries.find((x) => x.id === id);
  return c ? `${c.flag ?? ""} ${c.name}`.trim() : "—";
}

function chartHeight(n: number, min = 160) {
  return Math.max(min, n * 30 + 40);
}

/* =================================================================== PEOPLE */
export async function PeopleTab({ ctx, period, tz, country }: TabProps) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const { fromUtc, toUtc } = utcRange(period.from, period.to, tz);
  const showPeople = ctx.canAny("view_employee_hours", "view_all_employees", "approve_hours");

  const [cur, prev, projects, countries, tasks] = await Promise.all([
    sb.rpc("analytics_hours_by_employee", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_hours_by_employee", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo, p_country: country }),
    sb.rpc("analytics_project_summary", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    country ? Promise.resolve({ data: null }) : sb.rpc("analytics_country_comparison", { p_org: org, p_from: period.from, p_to: period.to }),
    fetchAll((a, b) => sb.from("tasks").select("status, deadline, project:projects(country_id)")
      .eq("organization_id", org).is("deleted_at", null).gte("deadline", fromUtc).lt("deadline", toUtc).range(a, b), 5000),
  ]);

  const rows = (cur.data ?? []).filter((r) => num(r.total_hours) > 0);
  const prevRows = prev.data ?? [];
  const sum = (list: typeof rows, k: "total_hours" | "overtime_hours" | "days_worked" | "break_hours") => list.reduce((a, r) => a + num(r[k]), 0);
  const hours = sum(rows, "total_hours");
  const prevHours = sum(prevRows, "total_hours");
  const overtime = sum(rows, "overtime_hours");
  const days = sum(rows, "days_worked");
  const prevEmployees = prevRows.filter((r) => num(r.total_hours) > 0).length;

  const taskRows = tasks.rows.filter((t) => !country || !t.project || (t.project as { country_id: string | null }).country_id === country);
  const counted = taskRows.filter((t) => t.status !== "cancelled");
  const done = counted.filter((t) => t.status === "done").length;
  const now = Date.now();
  const overdue = counted.filter((t) => t.status !== "done" && t.deadline && Date.parse(t.deadline) < now).length;
  const completion = counted.length ? (done / counted.length) * 100 : null;

  const empChart: ChartRow[] = rows.slice(0, 15).map((r) => ({
    name: short(r.full_name), regular: Math.round((num(r.total_hours) - num(r.overtime_hours)) * 10) / 10, overtime: num(r.overtime_hours),
  }));
  const projChart: ChartRow[] = (projects.data ?? []).filter((p) => num(p.hours) > 0)
    .sort((a, b) => num(b.hours) - num(a.hours)).slice(0, 12).map((p) => ({ name: p.code, hours: num(p.hours) }));
  const countryChart: ChartRow[] = (countries.data ?? []).map((c) => ({ name: c.name, hours: num(c.hours) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={ctx.t("analytics.totalHours")} value={fmtHours(hours)}
          delta={<Delta current={hours} previous={prevHours} label={ctx.t("analytics.vsPrevious")} />} />
        <Metric label={ctx.t("analytics.activeEmployees")} value={fmtNumber(rows.length)}
          delta={<Delta current={rows.length} previous={prevEmployees} />}
          sub={rows.length ? `${ctx.t("analytics.avgPerEmployee")}: ${fmtHours(hours / rows.length)}` : undefined} />
        <Metric label={ctx.t("analytics.overtime")} value={fmtHours(overtime)}
          sub={hours > 0 ? `${fmtNumber((overtime / hours) * 100, 1)} %` : undefined} />
        <Metric label={ctx.t("analytics.workDays")} value={fmtNumber(days)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={ctx.t("hours.empty")} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title={ctx.t("analytics.hoursPerEmployee")} subtitle={ctx.t("analytics.top", { n: 15 })} icon={<Users className="h-4 w-4" />} />
            <CardBody>
              {showPeople ? (
                <Bars data={empChart} x="name" horizontal stacked unit="h" height={chartHeight(empChart.length)}
                  series={[{ key: "regular", label: ctx.t("hours.regular") }, { key: "overtime", label: ctx.t("hours.overtime"), color: "#e2a23b" }]} />
              ) : <p className="text-sm text-muted">{ctx.t("analytics.sensitiveHidden")}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={ctx.t("analytics.hoursPerProject")} icon={<TreePine className="h-4 w-4" />} />
            <CardBody>
              {projChart.length ? <Bars data={projChart} x="name" horizontal unit="h" height={chartHeight(projChart.length)} series={[{ key: "hours", label: ctx.t("hours.total") }]} />
                : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={ctx.t("analytics.taskCompletion")} icon={<CheckCircle2 className="h-4 w-4" />} subtitle={ctx.t("tasks.title")} />
          <CardBody className="space-y-4">
            {completion === null ? <p className="text-sm text-muted">{ctx.t("common.notEnoughData")}</p> : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <span className="font-display text-4xl font-bold tabular">{fmtNumber(completion, 0)} %</span>
                  <span className="text-xs text-muted tabular">{done} / {counted.length}</span>
                </div>
                <Progress value={completion} tone={completion >= 80 ? "forest" : completion >= 50 ? "amber" : "crit"} />
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><div className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.tasksDone")}</div><div className="tabular">{done}</div></div>
                  <div><div className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.tasksOpen")}</div><div className="tabular">{counted.length - done}</div></div>
                  <div><div className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.tasksOverdue")}</div><div className={overdue ? "tabular text-crit" : "tabular"}>{overdue}</div></div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
        {!country && (
          <Card>
            <CardHeader title={ctx.t("analytics.hoursPerCountry")} icon={<Globe2 className="h-4 w-4" />} />
            <CardBody>
              {countryChart.some((c) => num(c.hours) > 0) ? <Bars data={countryChart} x="name" unit="h" series={[{ key: "hours", label: ctx.t("hours.total") }]} />
                : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            </CardBody>
          </Card>
        )}
      </div>

      {showPeople && rows.length > 0 && (
        <Card>
          <CardHeader title={ctx.t("employees.title")} icon={<Clock className="h-4 w-4" />} />
          <CardBody>
            <MiniTable
              head={[{ label: ctx.t("common.employee") }, { label: ctx.t("common.country") }, { label: ctx.t("hours.total"), align: "right" },
                { label: ctx.t("hours.overtime"), align: "right" }, { label: ctx.t("hours.breaks"), align: "right" },
                { label: ctx.t("hours.daysWorked"), align: "right" }, { label: ctx.t("hours.projects"), align: "right" }]}
              rows={rows.map((r) => [
                <Link key="n" href={`/employees/${r.employee_id}`} className="font-medium hover:text-amber">{r.full_name}</Link>,
                <span key="c" className="text-muted">{countryLabel(ctx, r.country_id)}</span>,
                fmtHours(r.total_hours), num(r.overtime_hours) > 0 ? <span key="o" className="text-amber">{fmtHours(r.overtime_hours)}</span> : "—",
                fmtHours(r.break_hours), fmtNumber(r.days_worked), fmtNumber(r.projects),
              ])} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* =================================================================== FLEET */
export async function FleetTab({ ctx, period, tz, country }: TabProps) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const today = todayIn(tz);
  let mq = sb.from("machines").select("id, name, category, status, engine_hours, next_service_hours, next_service_at, country_id")
    .eq("organization_id", org).is("deleted_at", null).is("archived_at", null);
  if (country) mq = mq.eq("country_id", country);
  const [machines, cur, prev] = await Promise.all([
    mq,
    sb.rpc("analytics_machine_costs", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_machine_costs", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo, p_country: country }),
  ]);
  const list = machines.data ?? [];
  if (!list.length) return <EmptyState icon={<Tractor className="h-6 w-6" />} title={ctx.t("machines.empty")} />;

  const warn = ctx.settings?.service_warning_hours ?? 50;
  const soon = addDays(today, 14);
  const byStatus = new Map<string, number>();
  for (const m of list) byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
  const serviceDue = list.filter((m) =>
    (m.next_service_hours != null && m.engine_hours != null && m.next_service_hours - m.engine_hours <= warn)
    || (m.next_service_at != null && m.next_service_at.slice(0, 10) <= soon)).length;

  type Costs = NonNullable<typeof cur.data>;
  const totals = (rows: Costs) => rows.reduce((a, r) => ({
    fuelL: a.fuelL + num(r.fuel_litres), fuel: a.fuel + num(r.fuel_cost), maint: a.maint + num(r.maintenance_cost), repair: a.repair + num(r.repair_cost),
    total: a.total + num(r.total_cost), hours: a.hours + num(r.work_hours), downtime: a.downtime + num(r.downtime_hours), repairs: a.repairs + num(r.repairs_count),
  }), { fuelL: 0, fuel: 0, maint: 0, repair: 0, total: 0, hours: 0, downtime: 0, repairs: 0 });
  const rows = (cur.data ?? []).filter((r) => num(r.total_cost) > 0 || num(r.work_hours) > 0 || num(r.fuel_litres) > 0 || num(r.repairs_count) > 0);
  const t = totals(cur.data ?? []);
  const p = totals(prev.data ?? []);
  const costPerHour = t.hours > 0 && t.total > 0 ? t.total / t.hours : null;
  const prevCostPerHour = p.hours > 0 && p.total > 0 ? p.total / p.hours : null;

  const statusData = [...byStatus.entries()].map(([s, n]) => ({ name: ctx.label("machines.status", s), value: n }));
  const costChart: ChartRow[] = rows.filter((r) => num(r.total_cost) > 0).sort((a, b) => num(b.total_cost) - num(a.total_cost)).slice(0, 10)
    .map((r) => ({ name: short(r.name, 18), fuel: num(r.fuel_cost), maintenance: num(r.maintenance_cost), repair: num(r.repair_cost) }));
  const hoursChart: ChartRow[] = rows.filter((r) => num(r.work_hours) > 0).sort((a, b) => num(b.work_hours) - num(a.work_hours)).slice(0, 10)
    .map((r) => ({ name: short(r.name, 18), hours: num(r.work_hours) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={ctx.t("analytics.totalMachines")} value={fmtNumber(list.length)}
          sub={`${ctx.t("analytics.activeMachines")}: ${byStatus.get("active") ?? 0} · ${ctx.t("analytics.inactiveMachines")}: ${(byStatus.get("idle") ?? 0) + (byStatus.get("offline") ?? 0)}`} />
        <Metric label={ctx.t("analytics.serviceDue")} value={fmtNumber(serviceDue)} className={serviceDue ? "border-warn/30" : undefined}
          sub={`${ctx.label("machines.status", "maintenance")}: ${byStatus.get("maintenance") ?? 0} · ${ctx.label("machines.status", "broken")}: ${byStatus.get("broken") ?? 0}`} />
        <Metric label={ctx.t("analytics.totalOperatingCost")} value={t.total > 0 ? fmtMoney(t.total, "EUR") : ctx.t("common.noData")}
          delta={<Delta current={t.total} previous={p.total} invert label={ctx.t("analytics.vsPrevious")} />} />
        <Metric label={ctx.t("analytics.costPerHour")} value={costPerHour != null ? fmtMoney(costPerHour, "EUR") : ctx.t("common.notEnoughData")}
          delta={<Delta current={costPerHour} previous={prevCostPerHour} invert />} />
        <Metric label={ctx.t("analytics.operatingHours")} value={fmtHours(t.hours)} delta={<Delta current={t.hours} previous={p.hours} />} />
        <Metric label={ctx.t("analytics.fuelConsumption")} value={`${fmtNumber(t.fuelL)} L`} delta={<Delta current={t.fuelL} previous={p.fuelL} invert />} />
        <Metric label={ctx.t("analytics.repairCost")} value={t.repair > 0 ? fmtMoney(t.repair, "EUR") : "—"}
          sub={`${ctx.t("analytics.repairsCount")}: ${t.repairs}`} delta={<Delta current={t.repair} previous={p.repair} invert />} />
        <Metric label={ctx.t("analytics.downtime")} value={t.downtime > 0 ? `${fmtNumber(t.downtime, 1)} h` : "—"}
          delta={<Delta current={t.downtime} previous={p.downtime} invert />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader title={ctx.t("analytics.machineStatus")} icon={<Tractor className="h-4 w-4" />} />
          <CardBody className="grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Donut data={statusData} />
            <DonutLegend data={statusData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("analytics.costBreakdown")} subtitle={ctx.t("analytics.top", { n: 10 })} icon={<Wallet className="h-4 w-4" />} />
          <CardBody>
            {costChart.length ? (
              <Bars data={costChart} x="name" stacked unit="€" height={260} series={[
                { key: "fuel", label: ctx.t("analytics.fuelCost") }, { key: "maintenance", label: ctx.t("analytics.maintenanceCost") },
                { key: "repair", label: ctx.t("analytics.repairCost"), color: "#e0584f" }]} />
            ) : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={ctx.t("analytics.operatingHours")} subtitle={ctx.t("analytics.top", { n: 10 })} icon={<Clock className="h-4 w-4" />} />
        <CardBody>
          {hoursChart.length ? <Bars data={hoursChart} x="name" unit="h" series={[{ key: "hours", label: ctx.t("hours.total") }]} />
            : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={ctx.t("machines.title")} icon={<BarChart3 className="h-4 w-4" />} />
        <CardBody>
          <MiniTable empty={ctx.t("common.noData")}
            head={[{ label: ctx.t("common.machine") }, { label: ctx.t("analytics.operatingHours"), align: "right" }, { label: ctx.t("fuel.litres"), align: "right" },
              { label: ctx.t("analytics.fuelCost"), align: "right" }, { label: ctx.t("analytics.maintenanceCost"), align: "right" },
              { label: ctx.t("analytics.repairCost"), align: "right" }, { label: ctx.t("analytics.totalOperatingCost"), align: "right" },
              { label: ctx.t("analytics.costPerHour"), align: "right" }, { label: ctx.t("analytics.repairsCount"), align: "right" },
              { label: ctx.t("analytics.downtime"), align: "right" }]}
            rows={rows.map((r) => [
              <div key="n" className="min-w-0">
                <Link href={`/machines/${r.machine_id}`} className="font-medium hover:text-amber">{r.name}</Link>
                <div className="text-xs text-muted">{ctx.label("machines.categories", r.category)}</div>
              </div>,
              fmtHours(r.work_hours), numOrNull(r.fuel_litres) != null ? fmtNumber(r.fuel_litres, 1) : "—",
              numOrNull(r.fuel_cost) != null ? fmtMoney(r.fuel_cost, "EUR") : "—",
              numOrNull(r.maintenance_cost) != null ? fmtMoney(r.maintenance_cost, "EUR") : "—",
              numOrNull(r.repair_cost) != null ? fmtMoney(r.repair_cost, "EUR") : "—",
              numOrNull(r.total_cost) != null ? <strong key="t" className="font-semibold">{fmtMoney(r.total_cost, "EUR")}</strong> : "—",
              numOrNull(r.cost_per_hour) != null ? fmtMoney(r.cost_per_hour, "EUR") : <span key="x" className="text-xs text-faint">{ctx.t("common.notEnoughData")}</span>,
              fmtNumber(r.repairs_count), numOrNull(r.downtime_hours) != null ? `${fmtNumber(r.downtime_hours, 1)} h` : "—",
            ])} />
        </CardBody>
      </Card>
    </div>
  );
}

/* =================================================================== FUEL */
export async function FuelTab({ ctx, period, tz, country }: TabProps) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const { fromUtc, toUtc } = utcRange(period.from, period.to, tz);
  const [sum, prevSum, logs, machines, projects, countries] = await Promise.all([
    sb.rpc("analytics_fuel_summary", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_fuel_summary", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo, p_country: country }),
    fetchAll((a, b) => {
      let q = sb.from("fuel_logs").select("occurred_at, litres, total_amount, currency").eq("organization_id", org).is("deleted_at", null)
        .gte("occurred_at", fromUtc).lt("occurred_at", toUtc).order("occurred_at");
      if (country) q = q.eq("country_id", country);
      return q.range(a, b);
    }),
    sb.rpc("analytics_machine_costs", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_project_summary", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    country ? Promise.resolve({ data: null }) : sb.rpc("analytics_country_comparison", { p_org: org, p_from: period.from, p_to: period.to }),
  ]);
  const s = sum.data?.[0];
  const ps = prevSum.data?.[0];
  if (!s || !num(s.entries)) return <EmptyState icon={<Fuel className="h-6 w-6" />} title={ctx.t("fuel.empty")} />;

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const perDay = new Map<string, { litres: number; cost: number }>();
  const otherCur: Record<string, number> = {};
  for (const l of logs.rows) {
    const k = dayKey.format(new Date(l.occurred_at));
    const d = perDay.get(k) ?? { litres: 0, cost: 0 };
    d.litres += num(l.litres);
    if (l.currency === "EUR") d.cost += num(l.total_amount);
    else if (l.total_amount != null) otherCur[l.currency] = (otherCur[l.currency] ?? 0) + num(l.total_amount);
    perDay.set(k, d);
  }
  const trend: ChartRow[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    const v = perDay.get(d);
    trend.push({ day: fmtShortDate(d), litres: Math.round((v?.litres ?? 0) * 10) / 10 });
  }
  const byMachine: ChartRow[] = (machines.data ?? []).filter((m) => num(m.fuel_litres) > 0).sort((a, b) => num(b.fuel_litres) - num(a.fuel_litres))
    .slice(0, 10).map((m) => ({ name: short(m.name, 18), litres: num(m.fuel_litres) }));
  const byProject: ChartRow[] = (projects.data ?? []).filter((p) => num(p.fuel_litres) > 0).sort((a, b) => num(b.fuel_litres) - num(a.fuel_litres))
    .slice(0, 10).map((p) => ({ name: p.code, litres: num(p.fuel_litres) }));
  const byCountry = (countries.data ?? []).filter((c) => num(c.fuel_litres) > 0);
  const otherText = Object.entries(otherCur).map(([c, v]) => fmtMoney(v, c)).join(" · ");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Metric label={ctx.t("analytics.litres")} value={`${fmtNumber(s.litres)} L`} sub={`${ctx.t("analytics.fuelEntries")}: ${s.entries}`}
          delta={<Delta current={numOrNull(s.litres)} previous={numOrNull(ps?.litres)} invert label={ctx.t("analytics.vsPrevious")} />} />
        <Metric label={ctx.t("analytics.fuelCost")} value={numOrNull(s.cost_eur) != null ? fmtMoney(s.cost_eur, "EUR") : ctx.t("common.noData")}
          delta={<Delta current={numOrNull(s.cost_eur)} previous={numOrNull(ps?.cost_eur)} invert />}
          sub={otherText ? `+ ${otherText}` : undefined} />
        <Metric label={ctx.t("analytics.avgPrice")} value={numOrNull(s.avg_price_eur) != null ? `${fmtNumber(s.avg_price_eur, 3)} €/L` : ctx.t("common.noData")}
          delta={<Delta current={numOrNull(s.avg_price_eur)} previous={numOrNull(ps?.avg_price_eur)} invert />} />
        <Metric label={ctx.t("analytics.litresPerHour")} value={numOrNull(s.litres_per_hour) != null ? fmtNumber(s.litres_per_hour, 2) : ctx.t("common.notEnoughData")}
          delta={<Delta current={numOrNull(s.litres_per_hour)} previous={numOrNull(ps?.litres_per_hour)} invert />} />
        <Metric label={ctx.t("analytics.costPerHourEur")} value={numOrNull(s.cost_per_hour_eur) != null ? fmtMoney(s.cost_per_hour_eur, "EUR") : ctx.t("common.notEnoughData")}
          delta={<Delta current={numOrNull(s.cost_per_hour_eur)} previous={numOrNull(ps?.cost_per_hour_eur)} invert />} />
        <Metric label={ctx.t("analytics.previousPeriod")} value={numOrNull(ps?.litres) != null ? `${fmtNumber(ps?.litres)} L` : "—"}
          sub={numOrNull(ps?.cost_eur) != null ? fmtMoney(ps?.cost_eur, "EUR") : undefined} />
      </div>

      <Card>
        <CardHeader title={ctx.t("analytics.fuelTrend")} icon={<Fuel className="h-4 w-4" />} />
        <CardBody><AreaTrend data={trend} x="day" unit="L" height={240} series={[{ key: "litres", label: ctx.t("analytics.litres"), color: "#e2a23b" }]} /></CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={ctx.t("analytics.fuelByMachine")} subtitle={ctx.t("analytics.top", { n: 10 })} icon={<Tractor className="h-4 w-4" />} />
          <CardBody>{byMachine.length ? <Bars data={byMachine} x="name" horizontal unit="L" height={chartHeight(byMachine.length)} series={[{ key: "litres", label: ctx.t("analytics.litres") }]} />
            : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("analytics.fuelByProject")} subtitle={ctx.t("analytics.top", { n: 10 })} icon={<TreePine className="h-4 w-4" />} />
          <CardBody>{byProject.length ? <Bars data={byProject} x="name" horizontal unit="L" height={chartHeight(byProject.length)} series={[{ key: "litres", label: ctx.t("analytics.litres") }]} />
            : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}</CardBody>
        </Card>
      </div>

      {!country && byCountry.length > 0 && (
        <Card>
          <CardHeader title={ctx.t("analytics.fuelByCountry")} icon={<Globe2 className="h-4 w-4" />} />
          <CardBody>
            <MiniTable head={[{ label: ctx.t("common.country") }, { label: ctx.t("analytics.litres"), align: "right" }, { label: ctx.t("analytics.fuelCost"), align: "right" }]}
              rows={byCountry.map((c) => [countryLabel(ctx, c.country_id), fmtNumber(c.fuel_litres, 1), num(c.fuel_cost_eur) > 0 ? fmtMoney(c.fuel_cost_eur, "EUR") : "—"])} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* =================================================================== PROJECTS */
export async function ProjectsTab({ ctx, period, country }: TabProps) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const [cur, prev] = await Promise.all([
    sb.rpc("analytics_project_summary", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_project_summary", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo, p_country: country }),
  ]);
  const rows = (cur.data ?? []).filter((p) => p.status === "active" || num(p.hours) > 0 || num(p.fuel_litres) > 0 || num(p.expenses) > 0
    || Object.keys(productionMap(p.production)).length > 0);
  if (!rows.length) return <EmptyState icon={<TreePine className="h-6 w-6" />} title={ctx.t("projects.empty")} />;

  const hours = rows.reduce((a, p) => a + num(p.hours), 0);
  const prevHours = (prev.data ?? []).reduce((a, p) => a + num(p.hours), 0);
  const expenses = rows.reduce((a, p) => a + num(p.expenses), 0);
  const prevExpenses = (prev.data ?? []).reduce((a, p) => a + num(p.expenses), 0);
  const m3 = rows.reduce((a, p) => a + (productionMap(p.production).m3 ?? 0), 0);
  const prevM3 = (prev.data ?? []).reduce((a, p) => a + (productionMap(p.production).m3 ?? 0), 0);
  const withHours = rows.filter((p) => num(p.hours) > 0).length;
  const chart: ChartRow[] = rows.filter((p) => num(p.hours) > 0).sort((a, b) => num(b.hours) - num(a.hours)).slice(0, 12)
    .map((p) => ({ name: p.code, hours: num(p.hours) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={ctx.t("dashboard.kpi.projectsActive")} value={fmtNumber(withHours)} sub={`${rows.length} ${ctx.t("common.total").toLowerCase()}`} />
        <Metric label={ctx.t("analytics.totalHours")} value={fmtHours(hours)} delta={<Delta current={hours} previous={prevHours} label={ctx.t("analytics.vsPrevious")} />} />
        <Metric label={ctx.t("analytics.productionM3")} value={m3 > 0 ? fmtNumber(m3, 1) : ctx.t("common.noData")}
          delta={<Delta current={m3} previous={prevM3} />} sub={m3 > 0 && hours > 0 ? `${fmtNumber(m3 / hours, 2)} ${ctx.t("analytics.m3PerHour")}` : undefined} />
        <Metric label={ctx.t("analytics.expenses")} value={expenses > 0 ? fmtMoney(expenses, "EUR") : "—"} delta={<Delta current={expenses} previous={prevExpenses} invert />} />
      </div>

      {chart.length > 0 && (
        <Card>
          <CardHeader title={ctx.t("analytics.hoursPerProject")} subtitle={ctx.t("analytics.top", { n: 12 })} icon={<Clock className="h-4 w-4" />} />
          <CardBody><Bars data={chart} x="name" unit="h" series={[{ key: "hours", label: ctx.t("hours.total") }]} /></CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={ctx.t("projects.title")} icon={<TreePine className="h-4 w-4" />} />
        <CardBody>
          <MiniTable
            head={[{ label: ctx.t("common.project") }, { label: ctx.t("common.status") }, { label: ctx.t("hours.total"), align: "right" },
              { label: ctx.t("analytics.workers"), align: "right" }, { label: ctx.t("analytics.machines"), align: "right" },
              { label: ctx.t("analytics.litres"), align: "right" }, { label: ctx.t("analytics.fuelCost"), align: "right" },
              { label: ctx.t("analytics.expenses"), align: "right" }, { label: ctx.t("analytics.production"), align: "right" },
              { label: ctx.t("analytics.productivity"), align: "right" }, { label: ctx.t("analytics.repairs"), align: "right" },
              { label: ctx.t("analytics.downtime"), align: "right" }]}
            rows={rows.map((p) => {
              const prod = productionMap(p.production);
              const prodText = Object.entries(prod).map(([u, q]) => `${fmtNumber(q, 1)} ${ctx.label("production.units", u)}`).join(" · ");
              const productivity = prod.m3 && num(p.hours) > 0 ? `${fmtNumber(prod.m3 / num(p.hours), 2)} ${ctx.t("analytics.m3PerHour")}` : null;
              return [
                <div key="p" className="min-w-0">
                  <Link href={`/projects/${p.project_id}`} className="font-medium hover:text-amber">{p.code}</Link>
                  <div className="max-w-[220px] truncate text-xs text-muted">{countryLabel(ctx, p.country_id)} · {p.name}</div>
                </div>,
                <Badge key="s" tone={statusTone(p.status)}>{ctx.label("projects.status", p.status)}</Badge>,
                fmtHours(p.hours), fmtNumber(p.workers), fmtNumber(p.machines),
                numOrNull(p.fuel_litres) != null ? fmtNumber(p.fuel_litres, 1) : "—",
                numOrNull(p.fuel_cost) != null ? fmtMoney(p.fuel_cost, "EUR") : "—",
                numOrNull(p.expenses) != null ? fmtMoney(p.expenses, "EUR") : "—",
                prodText || "—",
                productivity ?? <span key="x" className="text-xs text-faint">{ctx.t("common.notEnoughData")}</span>,
                fmtNumber(p.repairs), numOrNull(p.downtime_hours) != null ? `${fmtNumber(p.downtime_hours, 1)} h` : "—",
              ];
            })} />
        </CardBody>
      </Card>
    </div>
  );
}

/* =================================================================== FINANCE */
export async function FinanceTab({ ctx, period, country }: TabProps) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const [cur, prev, machines] = await Promise.all([
    sb.rpc("analytics_expenses_by_category", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
    sb.rpc("analytics_expenses_by_category", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo, p_country: country }),
    sb.rpc("analytics_machine_costs", { p_org: org, p_from: period.from, p_to: period.to, p_country: country }),
  ]);
  const group = (rows: NonNullable<typeof cur.data>) => {
    const m = new Map<string, { total: number; count: number; cats: { category: string; total: number; count: number }[] }>();
    for (const r of rows) {
      const g = m.get(r.currency) ?? { total: 0, count: 0, cats: [] };
      g.total += num(r.total); g.count += num(r.count);
      g.cats.push({ category: r.category, total: num(r.total), count: num(r.count) });
      m.set(r.currency, g);
    }
    return m;
  };
  const byCur = group(cur.data ?? []);
  const prevByCur = group(prev.data ?? []);
  const currencies = [...byCur.keys()].sort((a, b) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)));
  const mc = (machines.data ?? []).reduce((a, r) => ({ fuel: a.fuel + num(r.fuel_cost), maint: a.maint + num(r.maintenance_cost), repair: a.repair + num(r.repair_cost) }),
    { fuel: 0, maint: 0, repair: 0 });

  return (
    <div className="space-y-6">
      {currencies.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title={ctx.t("expenses.empty")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {currencies.map((c) => {
              const g = byCur.get(c)!;
              return (
                <Metric key={c} label={`${ctx.t("analytics.expensesTotal")} · ${c}`} value={fmtMoney(g.total, c)} sub={`${ctx.t("analytics.count")}: ${g.count}`}
                  delta={<Delta current={g.total} previous={prevByCur.get(c)?.total} invert label={ctx.t("analytics.vsPrevious")} />} />
              );
            })}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {currencies.map((c) => {
              const g = byCur.get(c)!;
              const data = [...g.cats].sort((a, b) => b.total - a.total).map((x) => ({ name: ctx.label("expenses.categories", x.category), value: x.total }));
              return (
                <Card key={c}>
                  <CardHeader title={`${ctx.t("analytics.expensesByCategory")} · ${c}`} icon={<Wallet className="h-4 w-4" />} />
                  <CardBody className="grid items-center gap-4 sm:grid-cols-2">
                    <Donut data={data} unit={c} />
                    <DonutLegend data={data} unit={c} />
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <section>
        <SectionTitle>{ctx.t("analytics.machineCostsEur")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label={ctx.t("analytics.fuelCost")} value={mc.fuel > 0 ? fmtMoney(mc.fuel, "EUR") : "—"} />
          <Metric label={ctx.t("analytics.maintenanceCost")} value={mc.maint > 0 ? fmtMoney(mc.maint, "EUR") : "—"} />
          <Metric label={ctx.t("analytics.repairCost")} value={mc.repair > 0 ? fmtMoney(mc.repair, "EUR") : "—"} />
          <Metric label={ctx.t("analytics.totalOperatingCost")} value={mc.fuel + mc.maint + mc.repair > 0 ? fmtMoney(mc.fuel + mc.maint + mc.repair, "EUR") : "—"} />
        </div>
      </section>
    </div>
  );
}

/* =================================================================== COUNTRIES */
export async function CountriesTab({ ctx, period, country }: TabProps) {
  if (country) return <EmptyState icon={<Globe2 className="h-6 w-6" />} title={ctx.t("analytics.countryComparison")} text={ctx.t("analytics.countryFiltered")} />;
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const [cur, prev] = await Promise.all([
    sb.rpc("analytics_country_comparison", { p_org: org, p_from: period.from, p_to: period.to }),
    sb.rpc("analytics_country_comparison", { p_org: org, p_from: period.prevFrom, p_to: period.prevTo }),
  ]);
  const rows = cur.data ?? [];
  if (!rows.length) return <EmptyState icon={<Globe2 className="h-6 w-6" />} title={ctx.t("common.noData")} />;
  const prevMap = new Map((prev.data ?? []).map((r) => [r.country_id, r]));
  const chart: ChartRow[] = rows.map((r) => ({ name: r.name, hours: num(r.hours), fuel: num(r.fuel_litres), m3: num(r.production_m3) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const p = prevMap.get(r.country_id);
          return (
            <Card key={r.country_id} className="p-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{ctx.countries.find((c) => c.id === r.country_id)?.flag}</span>
                <span className="font-display text-xl font-bold uppercase tracking-wide">{r.name}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("hours.total")}</dt>
                  <dd className="tabular">{fmtHours(r.hours)} <Delta current={num(r.hours)} previous={numOrNull(p?.hours)} /></dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.employees")} / {ctx.t("analytics.machines")}</dt>
                  <dd className="tabular">{r.employees} / {r.machines}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.litres")}</dt>
                  <dd className="tabular">{fmtNumber(r.fuel_litres, 1)} <Delta current={num(r.fuel_litres)} previous={numOrNull(p?.fuel_litres)} invert /></dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.fuelCost")}</dt>
                  <dd className="tabular">{num(r.fuel_cost_eur) > 0 ? fmtMoney(r.fuel_cost_eur, "EUR") : "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.expenses")}</dt>
                  <dd className="tabular">{num(r.expenses_eur) > 0 ? fmtMoney(r.expenses_eur, "EUR") : "—"} <Delta current={num(r.expenses_eur)} previous={numOrNull(p?.expenses_eur)} invert /></dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("analytics.repairs")} · {ctx.t("analytics.productionM3")}</dt>
                  <dd className="tabular">{r.repairs} · {num(r.production_m3) > 0 ? fmtNumber(r.production_m3, 1) : "—"}</dd></div>
              </dl>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title={ctx.t("analytics.hoursPerCountry")} icon={<Clock className="h-4 w-4" />} />
          <CardBody><Bars data={chart} x="name" unit="h" series={[{ key: "hours", label: ctx.t("hours.total") }]} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("analytics.fuelByCountry")} icon={<Fuel className="h-4 w-4" />} />
          <CardBody><Bars data={chart} x="name" unit="L" series={[{ key: "fuel", label: ctx.t("analytics.litres"), color: "#e2a23b" }]} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("analytics.productionM3")} icon={<TreePine className="h-4 w-4" />} />
          <CardBody><Bars data={chart} x="name" unit="m³" series={[{ key: "m3", label: ctx.t("analytics.productionM3"), color: "#c09a6b" }]} /></CardBody>
        </Card>
      </div>
    </div>
  );
}
