import type { Metadata } from "next";
import { Banknote, Droplets, Fuel, Gauge } from "lucide-react";
import { Bars } from "@/components/charts";
import { FuelTable, type FuelRow } from "@/components/shared/lists";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { addDays, fmtDate, fmtMoney, fmtMoneyMap, fmtNumber, todayIn, utcToLocalInput, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { searchParamsToString, sp as one } from "@/lib/utils";
import { NewFuelDialog, type MachineMeta } from "./components";
import { consumptionByMachine, fleetConsumption, sumByCurrency } from "./stats";

export const metadata: Metadata = { title: "Degviela" };
const PAGE = 30;
const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Minimal structural view of a PostgREST filter builder, so one filter chain serves several selects. */
interface Filterable<T> {
  eq(column: string, value: string): T;
  is(column: string, value: null): T;
  gte(column: string, value: string): T;
  lt(column: string, value: string): T;
}
const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function FuelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const tz = ctx.timezone;
  const today = todayIn(tz);
  const machine = one(sp.machine);
  const project = one(sp.project);
  const employee = one(sp.employee);
  const country = one(sp.country) ?? ctx.countryId ?? undefined;
  const fromParam = one(sp.from);
  const toParam = one(sp.to);
  const defaultRange = !isDate(fromParam) && !isDate(toParam);
  const from = isDate(fromParam) ? fromParam : defaultRange ? addDays(today, -29) : null;
  const to = isDate(toParam) ? toParam : null;
  const seeAll = ctx.canAny("view_fuel", "edit_fuel");

  const opts = await getOptions(ctx);

  // shared filter chain for list + KPI queries (RLS narrows further to what the user may see)
  const applyFilters = <Q extends Filterable<Q>>(q: Q): Q => {
    let r = q.eq("organization_id", ctx.org.id).is("deleted_at", null);
    if (isUuid(machine)) r = r.eq("machine_id", machine);
    if (isUuid(project)) r = r.eq("project_id", project);
    if (isUuid(employee) && seeAll) r = r.eq("employee_id", employee);
    if (isUuid(country)) r = r.eq("country_id", country);
    if (from) r = r.gte("occurred_at", zonedMidnightUtc(from, tz).toISOString());
    if (to) r = r.lt("occurred_at", zonedMidnightUtc(addDays(to, 1), tz).toISOString());
    return r;
  };

  const [listRes, kpiRes] = await Promise.all([
    applyFilters(ctx.supabase.from("fuel_logs")
      .select("id, occurred_at, litres, total_amount, currency, engine_hours, fuel_type, location_text, source, employee:employees(id, full_name), machine:machines(id, name), project:projects(id, code)", { count: "exact" }))
      .order("occurred_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    applyFilters(ctx.supabase.from("fuel_logs").select("litres, total_amount, currency, engine_hours, occurred_at, machine_id, project_id"))
      .order("occurred_at", { ascending: true }).limit(10000),
  ]);
  const rows = (listRes.data ?? []) as FuelRow[];
  const kpi = kpiRes.data ?? [];

  const litres = kpi.reduce((a, r) => a + Number(r.litres), 0);
  const cost = sumByCurrency(kpi, (r) => r.total_amount, (r) => r.currency);
  const mainCurrency = cost.EUR != null ? "EUR" : Object.keys(cost)[0] ?? "EUR";
  const otherCosts = Object.fromEntries(Object.entries(cost).filter(([c]) => c !== mainCurrency));
  const eurLitres = kpi.filter((r) => r.currency === "EUR" && r.total_amount != null).reduce((a, r) => a + Number(r.litres), 0);
  const avgPrice = cost.EUR && eurLitres > 0 ? cost.EUR / eurLitres : null;
  const fleet = fleetConsumption(kpi);
  const perMachine = consumptionByMachine(kpi);

  const machineName = new Map(opts.machines.map((m) => [m.id, m.name]));
  const projectCode = new Map(opts.projects.map((p) => [p.id, p.code]));
  const byMachine = new Map<string, number>();
  const byProject = new Map<string, number>();
  for (const r of kpi) {
    if (r.machine_id) byMachine.set(r.machine_id, (byMachine.get(r.machine_id) ?? 0) + Number(r.litres));
    byProject.set(r.project_id ?? "", (byProject.get(r.project_id ?? "") ?? 0) + Number(r.litres));
  }
  const machineChart = [...byMachine.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, l]) => ({
    name: machineName.get(id) ?? "—", litres: Math.round(l), lph: perMachine.get(id)?.lph != null ? Math.round((perMachine.get(id)!.lph ?? 0) * 10) / 10 : null,
  }));
  const projectChart = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, l]) => ({
    name: id ? projectCode.get(id) ?? "—" : ctx.t("fuel.noProject"), litres: Math.round(l),
  }));

  const machineMeta: MachineMeta = Object.fromEntries(opts.machines.map((m) => [m.id, { projectId: m.current_project_id, engineHours: m.engine_hours, fuelType: null }]));
  const defaultCurrency = ctx.country?.currency ?? ctx.settings?.default_currency ?? "EUR";
  const countryOptions = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const rangeLabel = defaultRange ? ctx.t("fuel.last30") : `${from ? fmtDate(from) : "…"} – ${to ? fmtDate(to) : fmtDate(today)}`;

  const filters: FilterDef[] = [
    { type: "select", name: "machine", label: ctx.t("common.machine"), options: opts.machineOptions },
    { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
    ...(seeAll ? [{ type: "select" as const, name: "employee", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
    ...(ctx.countryId || ctx.countries.length < 2 ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: countryOptions }]),
    { type: "date", name: "from", label: ctx.t("common.from") },
    { type: "date", name: "to", label: ctx.t("common.to") },
  ];

  return (
    <>
      <PageHeader title={ctx.t("fuel.title")} subtitle={ctx.t("fuel.subtitle")}
        actions={
          <NewFuelDialog orgId={ctx.org.id} machines={opts.machineOptions} projects={opts.projectOptions}
            employees={ctx.can("edit_fuel") ? opts.employeeOptions : null} ownEmployeeId={ctx.employee?.id ?? null}
            fuelTypes={opts.fuelTypes} machineMeta={machineMeta} defaultMachineId={isUuid(machine) ? machine : null}
            defaultCurrency={defaultCurrency} nowLocal={utcToLocalInput(new Date().toISOString(), tz)} defaultOpen={one(sp.new) === "1"} />
        } />
      <FilterBar filters={filters} />

      <p className="mb-3 text-xs uppercase tracking-[0.14em] text-muted">{rangeLabel}</p>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ctx.t("fuel.litres")} value={Math.round(litres)} suffix="L" icon={<Droplets className="h-4 w-4" />} tone="amber"
          sub={ctx.t("fuel.records", { n: kpi.length })} />
        <KpiCard label={ctx.t("fuel.totalAmount")} value={cost[mainCurrency] ?? null} decimals={0} suffix={mainCurrency} icon={<Banknote className="h-4 w-4" />} tone="forest" delay={60}
          noData={ctx.t("common.noData")} sub={fmtMoneyMap(otherCosts) ?? (avgPrice != null ? `${ctx.t("fuel.avgPrice")}: ${fmtMoney(avgPrice, "EUR")}/L` : undefined)} />
        <KpiCard label={ctx.t("fuel.lPerHour")} value={fleet.lph} decimals={1} suffix="L/h" icon={<Gauge className="h-4 w-4" />} tone="info" delay={120}
          noData={ctx.t("common.notEnoughData")} sub={fleet.lph != null ? ctx.t("fuel.measuredOver", { h: fmtNumber(fleet.hours, 0) }) : ctx.t("fuel.needEngineHours")} />
        <KpiCard label={ctx.t("fuel.costPerHour")} value={fleet.lph != null && avgPrice != null ? Math.round(fleet.lph * avgPrice * 100) / 100 : null} decimals={2} suffix="€/h"
          icon={<Fuel className="h-4 w-4" />} tone="wood" delay={180} noData={ctx.t("common.notEnoughData")} sub={avgPrice != null ? `${ctx.t("fuel.avgPrice")}: ${fmtMoney(avgPrice, "EUR")}/L` : undefined} />
      </div>

      {kpi.length > 0 && (
        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title={ctx.t("fuel.byMachine")} subtitle={ctx.t("fuel.topTen")} />
            <CardBody><Bars data={machineChart} x="name" series={[{ key: "litres", label: ctx.t("fuel.litres") }]} unit="L" horizontal height={Math.max(180, machineChart.length * 34)} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={ctx.t("fuel.byProject")} subtitle={ctx.t("fuel.topTen")} />
            <CardBody><Bars data={projectChart} x="name" series={[{ key: "litres", label: ctx.t("fuel.litres") }]} unit="L" horizontal height={Math.max(180, projectChart.length * 34)} /></CardBody>
          </Card>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Fuel className="h-6 w-6" />} title={ctx.t("fuel.empty")} text={ctx.t("fuel.emptyHint")} />
      ) : (
        <FuelTable rows={rows} tr={ctx} tz={tz} />
      )}
      <Pagination page={page} pageSize={PAGE} total={listRes.count ?? 0} hrefFor={(p) => `/fuel${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
