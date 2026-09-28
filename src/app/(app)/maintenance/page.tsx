import type { Metadata } from "next";
import { CalendarClock, ClipboardList, HeartPulse, Timer, TriangleAlert, User, Wrench } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg } from "@/lib/context";
import { fmtDate, fmtMoney, fmtNumber, fmtRelative, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { cn, priorityTone, sp as one, statusTone } from "@/lib/utils";
import { AddMaintenanceDialog } from "../machines/components";
import { healthTone, machineHealth, type Health, type HealthResult } from "../machines/health";
import { CategoryIcon, ServiceMeter } from "../machines/ui";
import { ReportProblemDialog } from "../repairs/components";
import { OPEN_REPAIR_STATUSES, priorityRank, REPAIR_PRIORITIES } from "../repairs/workflow";

export const metadata: Metadata = { title: "Apkope un remonti" };

const BOARD: Health[] = ["critical", "overdue", "soon", "healthy"];
const BOARD_LIMIT = 8;
const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const priority = one(sp.priority);
  const machineFilter = one(sp.machine);
  const country = ctx.countryId;
  const today = todayIn(ctx.timezone);
  const canWrite = ctx.canAny("manage_machines", "manage_repairs");

  let mq = ctx.supabase.from("machines")
    .select("id, name, category, status, internal_code, engine_hours, last_service_hours, service_interval_hours, next_service_hours, next_service_at, last_service_at, country_id")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null).order("name").limit(1000);
  if (country) mq = mq.eq("country_id", country);

  let rq = ctx.supabase.from("repair_requests")
    .select("id, title, priority, status, created_at, category, machine_down_since, machine:machines(id, name, country_id), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(full_name)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).in("status", [...OPEN_REPAIR_STATUSES]).order("created_at", { ascending: false }).limit(500);
  if (priority && (REPAIR_PRIORITIES as readonly string[]).includes(priority)) rq = rq.eq("priority", priority);
  if (isUuid(machineFilter)) rq = rq.eq("machine_id", machineFilter);

  const [machinesRes, repairsRes, criticalRes, recordsRes, opts] = await Promise.all([
    mq,
    rq,
    ctx.supabase.from("repair_requests").select("machine_id").eq("organization_id", ctx.org.id).is("deleted_at", null).eq("priority", "critical").in("status", [...OPEN_REPAIR_STATUSES]),
    ctx.supabase.from("maintenance_records")
      .select("id, performed_at, maintenance_type, engine_hours, cost, currency, external_service, machine:machines(id, name), performer:employees(full_name)")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("performed_at", { ascending: false }).limit(20),
    getOptions(ctx),
  ]);

  const critMachines = new Set((criticalRes.data ?? []).map((r) => r.machine_id));
  const machines = (machinesRes.data ?? []).map((m) => ({
    ...m, h: machineHealth(m, { warningHours: ctx.settings?.service_warning_hours, openCritical: critMachines.has(m.id), today }),
  }));
  const byHealth = (k: Health) => machines.filter((m) => m.h.health === k).sort((a, b) => (a.h.remaining ?? 1e9) - (b.h.remaining ?? 1e9));
  const unknownCount = machines.filter((m) => m.h.health === "unknown").length;

  const repairs = (repairsRes.data ?? []).filter((r) => !country || r.machine?.country_id === country)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.created_at.localeCompare(a.created_at));
  const upcoming = machines.filter((m) => m.h.health !== "unknown" && (m.h.remaining != null || m.h.daysLeft != null) && m.h.health !== "critical")
    .sort((a, b) => urgency(a.h) - urgency(b.h)).slice(0, 8);

  const machineProjects = Object.fromEntries(opts.machines.map((x) => [x.id, x.current_project_id]));
  const defaultCurrency = ctx.country?.currency ?? ctx.settings?.default_currency ?? "EUR";
  const newParam = one(sp.new);
  type RecordRow = NonNullable<typeof recordsRes.data>[number];

  return (
    <>
      <PageHeader title={ctx.t("maintenance.title")} subtitle={ctx.t("maintenance.subtitle")}
        actions={<>
          <ReportProblemDialog orgId={ctx.org.id} machines={opts.machineOptions} projects={opts.projectOptions} categories={opts.problemCategories}
            machineProjects={machineProjects} defaultMachineId={isUuid(one(sp.machine)) ? one(sp.machine) : null} defaultOpen={newParam === "repair"} />
          {canWrite && (
            <AddMaintenanceDialog machines={opts.machineOptions} employees={opts.employeeOptions} defaultCurrency={defaultCurrency} today={today} defaultOpen={newParam === "maintenance"} />
          )}
          <Link href="/repairs" className={buttonClass("ghost")}><ClipboardList className="h-4 w-4" /> {ctx.t("maintenance.allRepairs")}</Link>
        </>} />

      {/* fleet health KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BOARD.map((k, i) => (
          <KpiCard key={k} label={ctx.label("machines.health", k)} value={machines.filter((m) => m.h.health === k).length} delay={i * 50}
            icon={k === "healthy" ? <HeartPulse className="h-4 w-4" /> : k === "soon" ? <CalendarClock className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
            tone={k === "critical" ? "crit" : k === "overdue" ? "amber" : k === "soon" ? "warn" : "forest"} href={`/machines?health=${k}`}
            sub={k === "healthy" && unknownCount > 0 ? ctx.t("maintenance.noDataCount", { n: unknownCount }) : undefined} />
        ))}
      </div>

      {/* open repairs board */}
      <section className="mb-8" aria-labelledby="repairs-board">
        <SectionTitle action={<span className="text-xs text-muted tabular">{ctx.t("maintenance.openCount", { n: repairs.length })}</span>}>
          <span id="repairs-board">{ctx.t("maintenance.openRepairs")}</span>
        </SectionTitle>
        <FilterBar filters={[
          { type: "select", name: "priority", label: ctx.t("common.priority"), options: REPAIR_PRIORITIES.map((p) => ({ value: p, label: ctx.label("repairs.priority", p) })) },
          { type: "select", name: "machine", label: ctx.t("common.machine"), options: opts.machineOptions },
        ]} />
        {repairs.length === 0 ? (
          <EmptyState icon={<Wrench className="h-6 w-6" />} title={ctx.t("repairs.empty")} text={priority || machineFilter ? undefined : ctx.t("maintenance.allGood")} />
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {OPEN_REPAIR_STATUSES.map((s) => {
              const col = repairs.filter((r) => r.status === s);
              return (
                <div key={s} className="w-[82vw] max-w-[320px] shrink-0 snap-start sm:w-72">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <Badge tone={statusTone(s)} dot>{ctx.label("repairs.status", s)}</Badge>
                    <span className="text-xs tabular text-muted">{col.length}</span>
                  </div>
                  <ul className="min-h-24 space-y-2 rounded-2xl border border-dashed border-line bg-bg-2/40 p-2">
                    {col.map((r) => (
                      <li key={r.id}>
                        <Link href={`/repairs/${r.id}`} className={cn("card card-hover block p-3", r.priority === "critical" && "border-crit/40")}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
                            <Badge tone={priorityTone(r.priority)} dot pulse={r.priority === "critical"}>{ctx.label("repairs.priority", r.priority)}</Badge>
                          </div>
                          <div className="mt-2 truncate text-xs text-ink-2">{r.machine?.name ?? "—"}</div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted">
                            <span className="flex min-w-0 items-center gap-1"><User className="h-3 w-3 shrink-0" /><span className="truncate">{r.mechanic?.full_name ?? ctx.t("repairs.unassigned")}</span></span>
                            <span className="flex shrink-0 items-center gap-1"><Timer className="h-3 w-3" />{fmtRelative(r.machine_down_since ?? r.created_at)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                    {!col.length && <li className="py-6 text-center text-xs text-faint">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* fleet health board */}
      <section className="mb-8" aria-labelledby="health-board">
        <SectionTitle action={<Link href="/machines" className="text-xs text-amber hover:underline">{ctx.t("common.viewAll")}</Link>}>
          <span id="health-board">{ctx.t("machines.healthTitle")}</span>
        </SectionTitle>
        {machines.length === 0 ? (
          <EmptyState title={ctx.t("machines.empty")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BOARD.map((k) => {
              const list = byHealth(k);
              return (
                <Card key={k} className={cn(k === "critical" && list.length > 0 && "border-crit/40")}>
                  <CardHeader title={ctx.label("machines.health", k)} action={<Badge tone={healthTone(k)} dot pulse={k === "critical" && list.length > 0}>{list.length}</Badge>} />
                  <CardBody>
                    {list.length ? (
                      <ul className="space-y-2">
                        {list.slice(0, BOARD_LIMIT).map((m) => (
                          <li key={m.id}>
                            <Link href={`/machines/${m.id}?tab=maintenance`} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 hover:border-line-strong">
                              <CategoryIcon category={m.category} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-sm font-medium">{m.name}</span>
                                  <span className="shrink-0 text-[11px] tabular text-muted">{m.engine_hours != null ? `${fmtNumber(m.engine_hours)} h` : ""}</span>
                                </div>
                                <ServiceMeter h={m.h} tr={ctx} compact />
                              </div>
                            </Link>
                          </li>
                        ))}
                        {list.length > BOARD_LIMIT && (
                          <li><Link href={`/machines?health=${k}`} className="block py-1 text-center text-xs text-amber hover:underline">+{list.length - BOARD_LIMIT}</Link></li>
                        )}
                      </ul>
                    ) : <p className="py-4 text-center text-sm text-faint">—</p>}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* upcoming services */}
        <Card>
          <CardHeader title={ctx.t("maintenance.upcoming")} icon={<CalendarClock className="h-4 w-4" />} />
          <CardBody>
            {upcoming.length ? (
              <ul className="divide-y divide-line/70">
                {upcoming.map((m) => (
                  <li key={m.id}>
                    <Link href={`/machines/${m.id}?tab=maintenance`} className="flex items-center gap-3 py-2.5 hover:text-ink">
                      <CategoryIcon category={m.category} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                      <span className="text-right text-xs">
                        <span className={cn("block tabular", m.h.remaining != null && m.h.remaining < 0 ? "text-crit" : "text-ink-2")}>
                          {m.h.remaining != null ? (m.h.remaining < 0 ? ctx.t("machines.overdueBy", { n: fmtNumber(-m.h.remaining) }) : ctx.t("machines.remainingHours", { n: fmtNumber(m.h.remaining) })) : "—"}
                        </span>
                        {m.next_service_at && <span className="block text-faint">{fmtDate(m.next_service_at)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-sm text-muted">{ctx.t("common.noData")}</p>}
          </CardBody>
        </Card>

        {/* maintenance records */}
        <div>
          <SectionTitle>{ctx.t("maintenance.records")}</SectionTitle>
          <DataTable<RecordRow> rows={recordsRes.data ?? []} rowKey={(r) => r.id}
            empty={<EmptyState icon={<ClipboardList className="h-6 w-6" />} title={ctx.t("maintenance.empty")} />}
            columns={[
              { key: "d", header: ctx.t("common.date"), cell: (r) => fmtDate(r.performed_at) },
              { key: "m", header: ctx.t("common.machine"), cell: (r) => r.machine ? <Link href={`/machines/${r.machine.id}?tab=maintenance`} className="hover:text-amber">{r.machine.name}</Link> : "—" },
              { key: "t", header: ctx.t("common.type"), cell: (r) => ctx.label("maintenance.type", r.maintenance_type) },
              { key: "h", header: ctx.t("machines.engineHours"), cell: (r) => r.engine_hours != null ? `${fmtNumber(r.engine_hours)} h` : "—", align: "right", hideOnMobile: true },
              { key: "by", header: ctx.t("maintenance.performedBy"), cell: (r) => r.external_service ?? r.performer?.full_name ?? "—", hideOnMobile: true },
              { key: "c", header: ctx.t("maintenance.cost"), cell: (r) => fmtMoney(r.cost, r.currency), align: "right" },
            ]} />
        </div>
      </div>
    </>
  );
}

/** Sort key: overdue first, then by remaining hours / days (≈ 10 engine hours per working day). */
function urgency(h: HealthResult) {
  const byHours = h.remaining ?? Number.POSITIVE_INFINITY;
  const byDays = h.daysLeft != null ? h.daysLeft * 10 : Number.POSITIVE_INFINITY;
  return Math.min(byHours, byDays);
}
