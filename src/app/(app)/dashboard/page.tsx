import type { Metadata } from "next";
import { AlertTriangle, Boxes, Clock, Fuel, ShieldCheck, Tractor, TreePine, Users, Wallet, Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AreaTrend, Bars, Donut, DonutLegend } from "@/components/charts";
import { AlertList, type AlertRow } from "@/components/dashboard/alert-list";
import { CompaniesCard } from "@/components/dashboard/companies-card";
import { ProfitabilityCard } from "@/components/dashboard/profitability-card";
import { EmployeeQuickActions, MiniStat, OwnerQuickActions, type Stats } from "@/components/dashboard/widgets";
import { LiveMap } from "@/components/map";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi";
import { Avatar, EmptyState, Progress, Skeleton } from "@/components/ui/misc";
import { requireOrg, type OrgContext } from "@/lib/context";
import { addDays, fmtDate, fmtHours, fmtMoney, fmtMoneyMap, fmtNumber, fmtShortDate, fmtTime, hoursBetween, todayIn } from "@/lib/format";
import { getMapData } from "@/lib/map-data";
import { greetingKey, vocative } from "@/lib/queries";
import { statusTone } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const first = ctx.employee?.first_name ?? ctx.profile?.full_name?.split(" ")[0] ?? "";
  const greeting = `${ctx.t(greetingKey(ctx.timezone) as "greeting.morning")}, ${vocative(first)}`.toUpperCase();
  const country = ctx.countryId ?? undefined;

  const [statsRes, alertsRes] = await Promise.all([
    ctx.supabase.rpc("dashboard_stats", { p_org: ctx.org.id, p_country: country }),
    ctx.supabase.rpc("get_alerts", { p_org: ctx.org.id, p_country: country }),
  ]);
  const stats = (statsRes.data ?? {}) as unknown as Stats;
  const alerts = (alertsRes.data ?? []) as AlertRow[];

  const header = (
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between animate-fade-up">
      <div className="shrink-0">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted">
          <span>{ctx.t("brand.name")}</span><span className="text-faint">·</span><span>{ctx.kind === "owner" ? ctx.t("brand.operationsCenter") : ctx.t("dashboard.title")}</span>
          {ctx.org.is_demo && <DemoBadge />}
        </div>
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide md:text-[44px]">{greeting}</h1>
        <p className="mt-2 text-sm text-muted">
          {new Intl.DateTimeFormat("lv-LV", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ctx.timezone }).format(new Date())}
          {ctx.country ? ` · ${ctx.country.flag ?? ""} ${ctx.country.name}` : ""}
        </p>
      </div>
      {ctx.kind === "owner" && <OwnerQuickActions tr={ctx} perms={ctx.permissions} />}
    </header>
  );

  return (
    <>
      {sp.denied === "1" && (
        <div role="alert" className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{ctx.t("errors.permission")}</div>
      )}
      {header}
      {ctx.kind === "owner" && <OwnerDashboard ctx={ctx} stats={stats} alerts={alerts} />}
      {ctx.kind === "manager" && <LeadDashboard ctx={ctx} stats={stats} alerts={alerts} title={ctx.t("dashboard.myTeam")} />}
      {ctx.kind === "foreman" && <LeadDashboard ctx={ctx} stats={stats} alerts={alerts} title={ctx.t("dashboard.todaysWork")} foreman />}
      {ctx.kind === "mechanic" && <MechanicDashboard ctx={ctx} alerts={alerts} />}
      {ctx.kind === "employee" && <EmployeeDashboard ctx={ctx} />}
    </>
  );
}

/* =========================================================================== OWNER */
async function OwnerDashboard({ ctx, stats, alerts }: { ctx: OrgContext; stats: Stats; alerts: AlertRow[] }) {
  const sb = ctx.supabase;
  const today = todayIn(ctx.timezone);
  const monthStart = today.slice(0, 8) + "01";
  const country = ctx.countryId ?? undefined;

  const [series, byCategory, countries, projects, fleet, working, mapData, monthFuel, monthRepairs, acks, rules, activeEmps] = await Promise.all([
    sb.rpc("dashboard_series", { p_org: ctx.org.id, p_days: 14, p_country: country }),
    sb.rpc("analytics_expenses_by_category", { p_org: ctx.org.id, p_from: monthStart, p_to: today, p_country: country }),
    ctx.countryId ? Promise.resolve({ data: null }) : sb.rpc("analytics_country_comparison", { p_org: ctx.org.id, p_from: monthStart, p_to: today }),
    sb.rpc("analytics_project_summary", { p_org: ctx.org.id, p_from: monthStart, p_to: today, p_country: country }),
    (() => {
      let q = sb.from("machines").select("id, name, category, status, engine_hours, next_service_hours, current_operator:employees!machines_current_operator_id_fkey(full_name), project:projects!machines_current_project_id_fkey(code)")
        .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null).order("name").limit(40);
      if (country) q = q.eq("country_id", country);
      return q;
    })(),
    sb.from("work_logs").select("id, started_at, employee:employees(id, full_name, job_title, country_id), project:projects(code), machine:machines(name)")
      .eq("organization_id", ctx.org.id).is("ended_at", null).is("deleted_at", null).order("started_at").limit(60),
    getMapData(ctx),
    (() => {
      let q = sb.from("fuel_logs").select("litres, total_amount, currency").eq("organization_id", ctx.org.id).is("deleted_at", null).gte("occurred_at", `${monthStart}T00:00:00Z`);
      if (country) q = q.eq("country_id", country);
      return q;
    })(),
    sb.rpc("analytics_machine_costs", { p_org: ctx.org.id, p_from: monthStart, p_to: today, p_country: country }),
    sb.from("safety_acknowledgements").select("rule_version_id", { count: "exact", head: true }).eq("organization_id", ctx.org.id),
    sb.from("safety_rules").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("is_active", true).eq("requires_acknowledgement", true),
    sb.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("status", "active").is("deleted_at", null).not("user_id", "is", null),
  ]);

  const seriesRows = (series.data ?? []).map((d) => ({ day: fmtShortDate(d.day), hours: Number(d.hours), fuel: Number(d.fuel_litres), m3: Number(d.production_m3) }));
  const catEur = (byCategory.data ?? []).filter((r) => r.currency === "EUR").map((r) => ({ name: ctx.label("expenses.categories", r.category), value: Number(r.total) }));
  const otherCur = (byCategory.data ?? []).filter((r) => r.currency !== "EUR");
  const workingList = (working.data ?? []).filter((w) => !country || (w.employee as { country_id: string | null } | null)?.country_id === country);
  const fuelByCur: Record<string, number> = {};
  let fuelLitres = 0;
  for (const f of monthFuel.data ?? []) { fuelLitres += Number(f.litres); if (f.total_amount != null) fuelByCur[f.currency] = (fuelByCur[f.currency] ?? 0) + Number(f.total_amount); }
  const repairEur = (monthRepairs.data ?? []).reduce((a, m) => a + Number(m.repair_cost ?? 0) + Number(m.maintenance_cost ?? 0), 0);
  const monthExpensesByCur: Record<string, number> = {};
  for (const r of byCategory.data ?? []) monthExpensesByCur[r.currency] = (monthExpensesByCur[r.currency] ?? 0) + Number(r.total);
  const ackTotal = (rules.count ?? 0) * (activeEmps.count ?? 0);
  const ackPct = ackTotal > 0 ? Math.min(100, Math.round(((acks.count ?? 0) / ackTotal) * 100)) : null;
  const fleetSorted = [...(fleet.data ?? [])].sort((a, b) => rank(a.status) - rank(b.status));
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-6">
      {/* Company status */}
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm animate-fade-up ${critical ? "border-crit/30 bg-crit/[0.07] text-ink" : "border-ok/25 bg-ok/[0.06] text-ink"}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${critical ? "bg-crit" : "bg-ok"} animate-pulse-ring`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${critical ? "bg-crit" : "bg-ok"}`} />
        </span>
        <span className="font-display font-semibold uppercase tracking-wider">{ctx.t("dashboard.companyStatus")}:</span>
        <span className="text-ink-2">
          {critical ? `${critical} kritiski brīdinājumi · ${stats.alerts - critical} citi` : stats.alerts ? `${stats.alerts} brīdinājumi — nekā kritiska` : ctx.t("dashboard.attentionEmpty")}
        </span>
      </div>

      {/* TODAY KPIs */}
      <section aria-labelledby="today">
        <h2 id="today" className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted">{ctx.t("dashboard.today")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label={ctx.t("dashboard.kpi.employeesWorking")} value={stats.employees_working} icon={<Users className="h-4 w-4" />} href="/hours"
            sub={ctx.t("dashboard.kpi.employeesWorkingOf", { working: stats.employees_working ?? 0, total: stats.employees_total ?? 0 })} delay={0} />
          <KpiCard label={ctx.t("dashboard.kpi.machinesActive")} value={stats.machines_active} icon={<Tractor className="h-4 w-4" />} href="/machines" tone="info"
            sub={ctx.t("dashboard.kpi.machinesActiveOf", { active: stats.machines_active ?? 0, total: stats.machines_total ?? 0 })} delay={40} />
          <KpiCard label={ctx.t("dashboard.kpi.projectsActive")} value={stats.projects_active} icon={<TreePine className="h-4 w-4" />} href="/projects" delay={80} />
          <KpiCard label={ctx.t("dashboard.kpi.hoursToday")} value={Number(stats.hours_today ?? 0)} decimals={1} suffix="h" icon={<Clock className="h-4 w-4" />} href="/hours" tone="wood" delay={120} />
          <KpiCard label={ctx.t("dashboard.kpi.fuelToday")} value={stats.fuel_litres_today} decimals={0} suffix="L" icon={<Fuel className="h-4 w-4" />} href="/fuel" tone="amber" delay={160}
            noData={ctx.t("common.noData")} sub={fmtMoneyMap(stats.fuel_cost_today) ?? undefined} />
          <KpiCard label={ctx.t("dashboard.kpi.expensesToday")} value={stats.expenses_today?.EUR ?? (Object.keys(stats.expenses_today ?? {}).length ? 0 : null)} decimals={0} suffix="€"
            icon={<Wallet className="h-4 w-4" />} href="/expenses" tone="wood" delay={200} noData={ctx.t("common.noData")}
            sub={Object.keys(stats.expenses_today ?? {}).filter((c) => c !== "EUR").length ? fmtMoneyMap(Object.fromEntries(Object.entries(stats.expenses_today).filter(([c]) => c !== "EUR"))) : undefined} />
          <KpiCard label={ctx.t("dashboard.kpi.repairsOpen")} value={stats.repairs_open} icon={<Wrench className="h-4 w-4" />} href="/maintenance" tone={stats.repairs_critical ? "crit" : "info"} delay={240}
            sub={stats.repairs_critical ? ctx.t("dashboard.kpi.repairsCritical", { n: stats.repairs_critical }) : undefined} />
          <KpiCard label={ctx.t("dashboard.kpi.alerts")} value={stats.alerts} icon={<AlertTriangle className="h-4 w-4" />} href="/alerts" tone={critical ? "crit" : "warn"} delay={280} />
        </div>
      </section>

      {/* LIVE MAP + ATTENTION */}
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title={ctx.t("dashboard.liveOperations")} subtitle={`${mapData.markers.filter((m) => m.kind === "machine").length} ${ctx.t("map.machines").toLowerCase()} · ${mapData.markers.filter((m) => m.kind === "project").length} ${ctx.t("map.projects").toLowerCase()}`}
            action={<ButtonLink href="/map" size="sm" variant="secondary">{ctx.t("map.title")}</ButtonLink>} />
          <div className="px-3 pb-3"><LiveMap markers={mapData.markers} height={420} regions={ctx.country ? [ctx.country.code] : ctx.countries.map((c) => c.code)} maponState={mapData.maponState} maponLastSuccess={mapData.maponLastSuccess} /></div>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.attention")} subtitle={`${alerts.length} ${ctx.t("alerts.title").toLowerCase()}`} icon={<AlertTriangle className="h-4 w-4" />}
            action={<ButtonLink href="/alerts" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="max-h-[440px] overflow-y-auto"><AlertList alerts={alerts} tr={ctx} limit={9} /></CardBody>
        </Card>
      </section>

      {/* COMPANIES + PROFITABILITY */}
      <section className="grid gap-6 xl:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64" />}><CompaniesCard ctx={ctx} /></Suspense>
        <Suspense fallback={<Skeleton className="h-64" />}><ProfitabilityCard ctx={ctx} /></Suspense>
      </section>

      {/* CHARTS */}
      <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <Card className="2xl:col-span-2">
          <CardHeader title={ctx.t("dashboard.charts.hoursByDay")} subtitle={ctx.t("dashboard.last14")} />
          <CardBody><AreaTrend data={seriesRows} x="day" series={[{ key: "hours", label: ctx.t("hours.total"), color: "#5a9866" }]} unit="h" /></CardBody>
        </Card>
        <Card className="2xl:col-span-2">
          <CardHeader title={ctx.t("dashboard.charts.fuelByDay")} subtitle={ctx.t("dashboard.last14")} />
          <CardBody><Bars data={seriesRows} x="day" series={[{ key: "fuel", label: ctx.t("fuel.litres"), color: "#e2a23b" }]} unit="L" /></CardBody>
        </Card>
        <Card className="2xl:col-span-2">
          <CardHeader title={ctx.t("dashboard.charts.expensesByCategory")} subtitle={`${ctx.t("common.thisMonth")} · EUR`} />
          <CardBody>
            {catEur.length ? (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <Donut data={catEur} unit="EUR" />
                <div>
                  <DonutLegend data={catEur} unit="€" />
                  {otherCur.length > 0 && <p className="mt-3 text-[11px] text-faint">{ctx.t("analytics.currencyNote")} {otherCur.map((o) => fmtMoney(o.total, o.currency, true)).join(" · ")}</p>}
                </div>
              </div>
            ) : <EmptyState title={ctx.t("common.noData")} className="py-8" />}
          </CardBody>
        </Card>
        <Card className="2xl:col-span-2">
          {countries.data ? (
            <>
              <CardHeader title={ctx.t("dashboard.charts.countryComparison")} subtitle={ctx.t("common.thisMonth")} />
              <CardBody>
                <Bars data={(countries.data ?? []).map((c) => ({ name: c.name, hours: Number(c.hours), fuel: Number(c.fuel_litres) }))} x="name"
                  series={[{ key: "hours", label: ctx.t("hours.total") + " (h)" }, { key: "fuel", label: ctx.t("fuel.litres") + " (L)", color: "#e2a23b" }]} />
              </CardBody>
            </>
          ) : (
            <>
              <CardHeader title={ctx.t("dashboard.charts.projectProduction")} subtitle={ctx.t("dashboard.last14")} />
              <CardBody><AreaTrend data={seriesRows} x="day" series={[{ key: "m3", label: "m³", color: "#c09a6b" }]} unit="m³" /></CardBody>
            </>
          )}
        </Card>
      </section>

      {/* PROJECTS / FLEET / PEOPLE */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title={ctx.t("dashboard.projectsTitle")} icon={<TreePine className="h-4 w-4" />} action={<ButtonLink href="/projects" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            {(projects.data ?? []).filter((p) => p.status === "active").slice(0, 6).map((p) => (
              <Link key={p.project_id} href={`/projects/${p.project_id}`} className="block rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 transition hover:border-line-strong">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold tracking-wide">{p.code}</span>
                  <span className="truncate text-sm text-muted">{p.name}</span>
                  <span className="ml-auto text-xs">{ctx.countries.find((c) => c.id === p.country_id)?.flag}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <span className="text-muted"><b className="block font-semibold tabular text-ink">{fmtNumber(p.hours, 0)}</b>h</span>
                  <span className="text-muted"><b className="block font-semibold tabular text-ink">{p.workers ?? 0}</b>{ctx.t("projects.workers").toLowerCase()}</span>
                  <span className="text-muted"><b className="block font-semibold tabular text-ink">{fmtNumber(p.fuel_litres, 0)}</b>L</span>
                  <span className="text-muted"><b className="block font-semibold tabular text-ink">{fmtNumber((p.production as Record<string, number> | null)?.m3, 0)}</b>m³</span>
                </div>
              </Link>
            ))}
            {!(projects.data ?? []).some((p) => p.status === "active") && <EmptyState title={ctx.t("projects.empty")} className="py-8" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.fleetTitle")} icon={<Tractor className="h-4 w-4" />} subtitle={`${stats.machines_active}/${stats.machines_total} · ${stats.machines_down} ${ctx.t("dashboard.kpi.machinesDown").toLowerCase()}`}
            action={<ButtonLink href="/machines" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody>
            <ul className="divide-y divide-line/70">
              {fleetSorted.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <Link href={`/machines/${m.id}`} className="flex items-center gap-3 py-2.5 hover:text-ink">
                    <Badge tone={statusTone(m.status)} dot pulse={m.status === "broken"}>{ctx.label("machines.status", m.status)}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{m.name}</span>
                      <span className="block truncate text-xs text-muted">{(m.current_operator as { full_name: string } | null)?.full_name ?? "—"} · {(m.project as { code: string } | null)?.code ?? "—"}</span>
                    </span>
                    <span className="text-right text-xs tabular text-muted">{m.engine_hours != null ? `${fmtNumber(m.engine_hours)} h` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.peopleTitle")} icon={<Users className="h-4 w-4" />} subtitle={`${workingList.length} ${ctx.t("work.active").toLowerCase()}`}
            action={<ButtonLink href="/hours" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody>
            <ul className="divide-y divide-line/70">
              {workingList.slice(0, 8).map((w) => {
                const e = w.employee as { id: string; full_name: string; job_title: string | null } | null;
                return (
                  <li key={w.id}>
                    <Link href={`/employees/${e?.id}`} className="flex items-center gap-3 py-2.5">
                      <Avatar name={e?.full_name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{e?.full_name}</span>
                        <span className="block truncate text-xs text-muted">{(w.project as { code: string } | null)?.code ?? "—"}{(w.machine as { name: string } | null)?.name ? ` · ${(w.machine as { name: string }).name}` : ""}</span>
                      </span>
                      <span className="text-right text-xs">
                        <span className="block tabular text-ink">{fmtHours(hoursBetween(w.started_at, null))}</span>
                        <span className="block text-faint">no {fmtTime(w.started_at, ctx.timezone)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {workingList.length === 0 && <li className="py-6 text-center text-sm text-muted">{ctx.t("common.noData")}</li>}
            </ul>
          </CardBody>
        </Card>
      </section>

      {/* FINANCE / PRODUCTION / SAFETY */}
      <section className="grid gap-6 lg:grid-cols-3">
        {ctx.can("view_finance") && (
          <Card>
            <CardHeader title={ctx.t("dashboard.financialSnapshot")} icon={<Wallet className="h-4 w-4" />} subtitle={`${ctx.t("common.thisMonth")} (${fmtDate(monthStart)} – ${fmtDate(today)})`} />
            <CardBody className="space-y-2">
              <MiniStat icon={Wallet} label={ctx.t("nav.expenses")} value={fmtMoneyMap(monthExpensesByCur, true) ?? ctx.t("common.noData")} href="/expenses" />
              <MiniStat icon={Fuel} label={`${ctx.t("nav.fuel")} · ${fmtNumber(fuelLitres, 0)} L`} value={fmtMoneyMap(fuelByCur, true) ?? ctx.t("common.noData")} href="/fuel" />
              <MiniStat icon={Wrench} label={`${ctx.t("analytics.repairCost")} + ${ctx.t("analytics.maintenanceCost").toLowerCase()}`} value={repairEur ? fmtMoney(repairEur, "EUR", true) : ctx.t("common.noData")} href="/maintenance" />
              <MiniStat icon={AlertTriangle} label={ctx.t("expenses.pending")} value={stats.expenses_pending ?? 0} href="/expenses?status=submitted" tone={stats.expenses_pending ? "warn" : undefined} />
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader title={ctx.t("production.title")} icon={<Boxes className="h-4 w-4" />} subtitle={ctx.t("common.thisMonth")} action={<ButtonLink href="/production" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody>
            {(projects.data ?? []).some((p) => p.production) ? (
              <Bars horizontal height={Math.max(160, (projects.data ?? []).filter((p) => p.production).length * 38)}
                data={(projects.data ?? []).filter((p) => p.production).map((p) => ({ code: p.code, m3: Number((p.production as Record<string, number>).m3 ?? 0), loads: Number((p.production as Record<string, number>).loads ?? 0) }))}
                x="code" series={[{ key: "m3", label: "m³", color: "#c09a6b" }, { key: "loads", label: ctx.t("production.units.loads"), color: "#7fa6c9" }]} />
            ) : <EmptyState title={ctx.t("common.noData")} className="py-8" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.safetyTitle")} icon={<ShieldCheck className="h-4 w-4" />} action={<ButtonLink href="/safety" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            <MiniStat icon={AlertTriangle} label={ctx.t("dashboard.kpi.incidentsOpen")} value={stats.incidents_open ?? 0} href="/incidents" tone={stats.incidents_open ? "crit" : "ok"} />
            <MiniStat icon={ShieldCheck} label={ctx.t("alerts.types.training_expiring")} value={alerts.filter((a) => a.alert_type === "training_expiring").length} href="/training?tab=records" tone={alerts.some((a) => a.alert_type === "training_expiring") ? "warn" : "ok"} />
            <div className="rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between text-sm"><span className="text-ink-2">{ctx.t("safety.coverage")}</span>
                <span className="font-display text-xl font-bold tabular">{ackPct === null ? "—" : `${ackPct}%`}</span></div>
              <Progress value={ackPct ?? 0} tone={ackPct !== null && ackPct < 60 ? "warn" : "forest"} />
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function rank(status: string) {
  return ({ broken: 0, maintenance: 1, active: 2, idle: 3, offline: 4 } as Record<string, number>)[status] ?? 5;
}

/* =========================================================================== MANAGER / FOREMAN */
async function LeadDashboard({ ctx, stats, alerts, title, foreman }: { ctx: OrgContext; stats: Stats; alerts: AlertRow[]; title: string; foreman?: boolean }) {
  const sb = ctx.supabase;
  const today = todayIn(ctx.timezone);
  const [team, tasks, working, mapData, prod, repairs] = await Promise.all([
    sb.from("employees").select("id, full_name, job_title, status").eq("organization_id", ctx.org.id).is("deleted_at", null).order("full_name"),
    sb.from("tasks").select("id, title, status, priority, deadline, assignee:employees(full_name), project:projects(code)").eq("organization_id", ctx.org.id)
      .in("status", ["todo", "in_progress", "waiting"]).order("deadline", { ascending: true, nullsFirst: false }).limit(8),
    sb.from("work_logs").select("id, employee_id, started_at, project:projects(code), machine:machines(name)").eq("organization_id", ctx.org.id).is("ended_at", null).is("deleted_at", null),
    getMapData(ctx),
    sb.from("production_logs").select("quantity, unit, project:projects(code)").eq("organization_id", ctx.org.id).gte("production_date", addDays(today, -6)),
    sb.from("repair_requests").select("id, title, priority, status, machine:machines(name)").eq("organization_id", ctx.org.id).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(5),
  ]);
  const workingByEmp = new Map((working.data ?? []).map((w) => [w.employee_id, w]));
  const weekProd: Record<string, number> = {};
  for (const p of prod.data ?? []) weekProd[p.unit] = (weekProd[p.unit] ?? 0) + Number(p.quantity);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-moss">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={ctx.t("nav.employees")} value={(team.data ?? []).length} sub={`${stats.employees_working} ${ctx.t("work.active").toLowerCase()}`} icon={<Users className="h-4 w-4" />} href="/employees" />
        <KpiCard label={ctx.t("nav.machines")} value={stats.machines_total} sub={`${stats.machines_active} ${ctx.t("map.legend.active").toLowerCase()}`} icon={<Tractor className="h-4 w-4" />} href="/machines" tone="info" delay={40} />
        <KpiCard label={ctx.t("nav.projects")} value={stats.projects_active} icon={<TreePine className="h-4 w-4" />} href="/projects" delay={80} />
        <KpiCard label={ctx.t("dashboard.kpi.hoursToday")} value={Number(stats.hours_today ?? 0)} decimals={1} suffix="h" icon={<Clock className="h-4 w-4" />} href="/hours" tone="wood" delay={120} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={foreman ? ctx.t("dashboard.checkins") : ctx.t("dashboard.myTeam")} icon={<Users className="h-4 w-4" />} />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(team.data ?? []).filter((e) => e.id !== ctx.employee?.id).map((e) => {
                const w = workingByEmp.get(e.id);
                return (
                  <li key={e.id}>
                    <Link href={`/employees/${e.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 hover:border-line-strong">
                      <Avatar name={e.full_name} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{e.full_name}</span>
                        <span className="block truncate text-xs text-muted">{w ? `${(w.project as { code: string } | null)?.code ?? ""} ${(w.machine as { name: string } | null)?.name ?? ""}` : e.job_title}</span>
                      </span>
                      {w ? <Badge tone="ok" dot pulse>{fmtHours(hoursBetween(w.started_at, null))}</Badge> : <Badge tone="off">{ctx.label("employees.status", e.status)}</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.attention")} icon={<AlertTriangle className="h-4 w-4" />} />
          <CardBody><AlertList alerts={alerts} tr={ctx} limit={6} dense /></CardBody>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title={ctx.t("nav.tasks")} action={<ButtonLink href="/tasks" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            {(tasks.data ?? []).map((tk) => (
              <Link key={tk.id} href={`/tasks?task=${tk.id}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-line-strong">
                <Badge tone={tk.priority === "critical" ? "crit" : tk.priority === "high" ? "amber" : "neutral"}>{ctx.label("tasks.priority", tk.priority)}</Badge>
                <span className="min-w-0 flex-1 truncate">{tk.title}</span>
                <span className="text-xs text-muted">{(tk.assignee as { full_name: string } | null)?.full_name?.split(" ")[0]}</span>
              </Link>
            ))}
            {!(tasks.data ?? []).length && <p className="py-4 text-center text-sm text-muted">{ctx.t("tasks.empty")}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.problems")} icon={<Wrench className="h-4 w-4" />} action={<ButtonLink href="/maintenance" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            {(repairs.data ?? []).map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-line-strong">
                <Badge tone={r.priority === "critical" ? "crit" : "warn"}>{ctx.label("repairs.priority", r.priority)}</Badge>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="truncate text-xs text-muted">{(r.machine as { name: string } | null)?.name}</span>
              </Link>
            ))}
            {!(repairs.data ?? []).length && <p className="py-4 text-center text-sm text-muted">{ctx.t("repairs.empty")}</p>}
            <MiniStat icon={AlertTriangle} label={ctx.t("dashboard.kpi.incidentsOpen")} value={stats.incidents_open ?? 0} href="/incidents" tone={stats.incidents_open ? "crit" : "ok"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("production.title")} subtitle="7 d." icon={<Boxes className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {Object.keys(weekProd).length ? Object.entries(weekProd).map(([u, q]) => (
              <MiniStat key={u} icon={Boxes} label={ctx.label("production.units", u)} value={fmtNumber(q, 0)} href="/production" />
            )) : <p className="py-4 text-center text-sm text-muted">{ctx.t("common.noData")}</p>}
          </CardBody>
        </Card>
      </div>
      {mapData.canGps && mapData.markers.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title={ctx.t("map.title")} />
          <div className="px-3 pb-3"><LiveMap markers={mapData.markers} height={360} regions={ctx.country ? [ctx.country.code] : ctx.countries.map((c) => c.code)} maponState={mapData.maponState} /></div>
        </Card>
      )}
    </div>
  );
}

/* =========================================================================== MECHANIC */
async function MechanicDashboard({ ctx, alerts }: { ctx: OrgContext; alerts: AlertRow[] }) {
  const sb = ctx.supabase;
  const [repairs, machines, parts, done] = await Promise.all([
    sb.from("repair_requests").select("id, title, priority, status, created_at, machine:machines(name), assigned_mechanic_id").eq("organization_id", ctx.org.id)
      .not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }),
    sb.from("machines").select("id, name, status, engine_hours, next_service_hours, next_service_at").eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null),
    sb.from("repair_parts").select("id, name, quantity, repair:repair_requests(title, status)").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(8),
    sb.from("repair_requests").select("id, title, completed_at, downtime_hours, machine:machines(name)").eq("organization_id", ctx.org.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(6),
  ]);
  const open = repairs.data ?? [];
  const critical = open.filter((r) => r.priority === "critical");
  const mine = open.filter((r) => r.assigned_mechanic_id === ctx.employee?.id);
  const due = (machines.data ?? []).filter((m) => m.next_service_hours != null && m.engine_hours != null && Number(m.next_service_hours) - Number(m.engine_hours) <= 50)
    .sort((a, b) => (Number(a.next_service_hours) - Number(a.engine_hours)) - (Number(b.next_service_hours) - Number(b.engine_hours)));
  const downtime = (done.data ?? []).reduce((a, r) => a + Number(r.downtime_hours ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={ctx.t("dashboard.openRepairs")} value={open.length} icon={<Wrench className="h-4 w-4" />} href="/maintenance" tone="info" />
        <KpiCard label={ctx.t("dashboard.criticalRepairs")} value={critical.length} icon={<AlertTriangle className="h-4 w-4" />} tone={critical.length ? "crit" : "forest"} href="/maintenance?priority=critical" delay={40} />
        <KpiCard label={ctx.t("dashboard.serviceDue")} value={due.length} icon={<Tractor className="h-4 w-4" />} tone="warn" href="/maintenance" delay={80} />
        <KpiCard label={ctx.t("dashboard.downtime")} value={downtime} decimals={1} suffix="h" icon={<Clock className="h-4 w-4" />} tone="wood" delay={120} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={ctx.t("dashboard.openRepairs")} subtitle={`${mine.length} piešķirti man`} action={<ButtonLink href="/maintenance" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            {open.slice(0, 8).map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 hover:border-line-strong">
                <Badge tone={r.priority === "critical" ? "crit" : r.priority === "high" ? "amber" : "neutral"} dot pulse={r.priority === "critical"}>{ctx.label("repairs.priority", r.priority)}</Badge>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.title}</span><span className="block truncate text-xs text-muted">{(r.machine as { name: string } | null)?.name}</span></span>
                <Badge tone={statusTone(r.status)}>{ctx.label("repairs.status", r.status)}</Badge>
              </Link>
            ))}
            {!open.length && <EmptyState title={ctx.t("repairs.empty")} className="py-8" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.serviceDue")} />
          <CardBody className="space-y-2">
            {due.slice(0, 8).map((m) => {
              const left = Number(m.next_service_hours) - Number(m.engine_hours);
              return (
                <Link key={m.id} href={`/machines/${m.id}`} className="block rounded-xl border border-line px-3.5 py-2.5 hover:border-line-strong">
                  <div className="flex items-center justify-between text-sm"><span>{m.name}</span>
                    <span className={left < 0 ? "text-crit" : "text-warn"}>{left < 0 ? `${ctx.t("maintenance.overdue")} ${fmtNumber(-left)} h` : `${ctx.t("machines.remaining")} ${fmtNumber(left)} h`}</span></div>
                  <Progress className="mt-2" value={Math.max(0, Math.min(100, 100 - (left / 50) * 100))} tone={left < 0 ? "crit" : "warn"} />
                </Link>
              );
            })}
            {!due.length && <p className="py-4 text-center text-sm text-muted">{ctx.t("common.noData")}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("dashboard.parts")} />
          <CardBody>
            <ul className="divide-y divide-line/70 text-sm">
              {(parts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2"><span className="truncate">{p.name}</span>
                  <span className="truncate text-xs text-muted">{fmtNumber(p.quantity)} × · {(p.repair as { title: string } | null)?.title}</span></li>
              ))}
              {!(parts.data ?? []).length && <li className="py-4 text-center text-muted">{ctx.t("common.noData")}</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("common.history")} />
          <CardBody>
            <ul className="divide-y divide-line/70 text-sm">
              {(done.data ?? []).map((r) => (
                <li key={r.id}><Link href={`/repairs/${r.id}`} className="flex items-center justify-between py-2 hover:text-ink">
                  <span className="truncate">{r.title} · <span className="text-muted">{(r.machine as { name: string } | null)?.name}</span></span>
                  <span className="text-xs text-muted">{fmtDate(r.completed_at, ctx.timezone)}</span></Link></li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      <Card><CardHeader title={ctx.t("dashboard.attention")} /><CardBody><AlertList alerts={alerts.filter((a) => ["repair_critical", "service_due", "telemetry_missing", "machine_inactive", "fuel_anomaly"].includes(a.alert_type))} tr={ctx} dense /></CardBody></Card>
    </div>
  );
}

/* =========================================================================== EMPLOYEE */
async function EmployeeDashboard({ ctx }: { ctx: OrgContext }) {
  const sb = ctx.supabase;
  const emp = ctx.employee;
  if (!emp) return <EmptyState title={ctx.t("work.noEmployee")} />;
  const today = todayIn(ctx.timezone);
  const weekStart = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const [active, hoursToday, hoursWeek, tasks, rules, acks, machine] = await Promise.all([
    sb.from("work_logs").select("id, started_at, project:projects(id, code, name), machine:machines(id, name)").eq("employee_id", emp.id).is("ended_at", null).is("deleted_at", null).maybeSingle(),
    sb.rpc("analytics_hours_by_employee", { p_org: ctx.org.id, p_from: today, p_to: today }),
    sb.rpc("analytics_hours_by_employee", { p_org: ctx.org.id, p_from: weekStart, p_to: today }),
    sb.from("tasks").select("id, title, priority, status, deadline, project:projects(code)").eq("assignee_employee_id", emp.id).in("status", ["todo", "in_progress", "waiting"]).order("deadline", { nullsFirst: false }).limit(6),
    sb.from("safety_rules").select("id, current_version").eq("organization_id", ctx.org.id).eq("is_active", true).eq("requires_acknowledgement", true),
    sb.from("safety_acknowledgements").select("rule_id, version").eq("employee_id", emp.id),
    sb.from("machines").select("id, name, engine_hours, status").eq("current_operator_id", emp.id).maybeSingle(),
  ]);
  const a = active.data;
  const myToday = (hoursToday.data ?? []).find((h) => h.employee_id === emp.id);
  const myWeek = (hoursWeek.data ?? []).find((h) => h.employee_id === emp.id);
  const ackSet = new Set((acks.data ?? []).map((x) => `${x.rule_id}:${x.version}`));
  const pendingSafety = (rules.data ?? []).filter((r) => !ackSet.has(`${r.id}:${r.current_version}`)).length;
  const proj = a?.project as { id: string; code: string; name: string } | null;
  const mach = (a?.machine as { id: string; name: string } | null) ?? machine.data;

  return (
    <div className="space-y-6">
      {a && (
        <Link href="/work" className="flex items-center gap-4 rounded-2xl border border-forest-500/50 bg-[linear-gradient(135deg,var(--forest-700),var(--surface))] px-5 py-4 animate-fade-up">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full rounded-full bg-ok animate-pulse-ring" /><span className="relative h-3 w-3 rounded-full bg-ok" /></span>
          <span className="flex-1">
            <span className="block font-display text-xl font-bold uppercase tracking-wider">{ctx.t("work.active")}</span>
            <span className="block text-sm text-ink-2">{ctx.t("work.started")}: {fmtTime(a.started_at, ctx.timezone)} · {proj?.code}{mach ? ` · ${mach.name}` : ""}</span>
          </span>
          <span className="font-display text-3xl font-bold tabular">{fmtHours(hoursBetween(a.started_at, null))}</span>
        </Link>
      )}
      <EmployeeQuickActions tr={ctx} active={Boolean(a)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={ctx.t("common.today")} value={Number(myToday?.total_hours ?? 0)} decimals={1} suffix="h" icon={<Clock className="h-4 w-4" />} href="/hours" />
        <KpiCard label={ctx.t("common.thisWeek")} value={Number(myWeek?.total_hours ?? 0)} decimals={1} suffix="h" icon={<Clock className="h-4 w-4" />} href="/hours" tone="wood" delay={40} />
        <KpiCard label={ctx.t("safety.pending")} value={pendingSafety} icon={<ShieldCheck className="h-4 w-4" />} href="/safety" tone={pendingSafety ? "warn" : "forest"} delay={80} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={ctx.t("dashboard.myTasks")} action={<ButtonLink href="/tasks" size="sm" variant="ghost">{ctx.t("common.viewAll")}</ButtonLink>} />
          <CardBody className="space-y-2">
            {(tasks.data ?? []).map((tk) => (
              <Link key={tk.id} href={`/tasks?task=${tk.id}`} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-3 text-sm hover:border-line-strong">
                <Badge tone={tk.priority === "critical" ? "crit" : tk.priority === "high" ? "amber" : "neutral"}>{ctx.label("tasks.priority", tk.priority)}</Badge>
                <span className="min-w-0 flex-1 truncate">{tk.title}</span>
                <span className="text-xs text-muted">{(tk.project as { code: string } | null)?.code}</span>
              </Link>
            ))}
            {!(tasks.data ?? []).length && <p className="py-4 text-center text-sm text-muted">{ctx.t("tasks.empty")}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`${ctx.t("dashboard.myProject")} / ${ctx.t("dashboard.myMachine")}`} />
          <CardBody className="space-y-2">
            {proj ? <MiniStat icon={TreePine} label={proj.name} value={proj.code} href={`/projects/${proj.id}`} /> : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            {mach && <MiniStat icon={Tractor} label={mach.name} value={machine.data?.engine_hours != null ? `${fmtNumber(machine.data.engine_hours)} h` : ""} href={`/machines/${mach.id}`} />}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
