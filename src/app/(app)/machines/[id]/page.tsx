import type { Metadata } from "next";
import { Archive, CalendarClock, Fuel, Gauge, History, MapPin, Satellite, Timer, User, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { DocumentTable, expiryBucket, FuelTable, RepairTable, type DocRow, type FuelRow, type RepairRow } from "@/components/shared/lists";
import { LiveMap } from "@/components/map";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DefinitionList, Stat } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg, type OrgContext } from "@/lib/context";
import { addDays, fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtMoneyMap, fmtNumber, hoursBetween, todayIn, utcToLocalInput, zonedMidnightUtc } from "@/lib/format";
import type { MapMarker } from "@/lib/map-data";
import { getOptions } from "@/lib/queries";
import { statusTone } from "@/lib/utils";
import { consumptionByMachine, sumByCurrency } from "../../fuel/stats";
import { ReportProblemDialog } from "../../repairs/components";
import { archiveMachine, endAssignment } from "../actions";
import { AddMaintenanceDialog, AssignOperatorDialog, ChangeStatusDialog, EditMachineDialog } from "../components";
import { machineHealth, type HealthResult } from "../health";
import { CategoryIcon, HealthBadge, ServiceMeter } from "../ui";

export const metadata: Metadata = { title: "Tehnikas profils" };

const TABS = ["overview", "assignments", "fuel", "maintenance", "repairs", "costs", "documents", "activity"] as const;
type Tab = (typeof TABS)[number];

async function loadMachine(ctx: OrgContext, id: string) {
  const { data } = await ctx.supabase.from("machines")
    .select("*, operator:employees!machines_current_operator_id_fkey(id, full_name, job_title), project:projects!machines_current_project_id_fkey(id, code, name)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  return data;
}
type Machine = NonNullable<Awaited<ReturnType<typeof loadMachine>>>;

export default async function MachineDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";

  const m = await loadMachine(ctx, id);
  if (!m) notFound();
  const country = ctx.countries.find((c) => c.id === m.country_id);
  const tz = country?.timezone ?? ctx.timezone;
  const today = todayIn(ctx.timezone);
  const path = `/machines/${id}`;
  const canManage = ctx.can("manage_machines");
  const canStatus = ctx.canAny("manage_machines", "manage_repairs");

  const [openRepairsRes, openAssignRes, opts] = await Promise.all([
    ctx.supabase.from("repair_requests").select("id, priority, status").eq("machine_id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).not("status", "in", "(completed,cancelled)"),
    ctx.supabase.from("machine_assignments").select("started_at").eq("machine_id", id).eq("organization_id", ctx.org.id).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    getOptions(ctx),
  ]);
  const openRepairs = openRepairsRes.data ?? [];
  const h = machineHealth(m, { warningHours: ctx.settings?.service_warning_hours, openCritical: openRepairs.some((r) => r.priority === "critical"), today });
  const defaultCurrency = country?.currency ?? ctx.settings?.default_currency ?? "EUR";
  const machineProjects = Object.fromEntries(opts.machines.map((x) => [x.id, x.current_project_id]));
  const sub = [[m.manufacturer, m.model].filter(Boolean).join(" "), m.year, m.internal_code].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        back={{ href: "/machines", label: ctx.t("machines.title") }}
        eyebrow={<><span aria-hidden>{country?.flag}</span><span>{ctx.label("machines.categories", m.category)}</span>{m.is_demo && <DemoBadge />}</>}
        title={<span className="flex items-center gap-3"><CategoryIcon category={m.category} size="lg" className="hidden sm:grid" />{m.name}</span>}
        subtitle={sub || undefined}
        actions={<>
          <Badge tone={statusTone(m.status)} dot pulse={m.status === "active" || m.status === "broken"} className="px-3 py-1 text-xs">{ctx.label("machines.status", m.status)}</Badge>
          <HealthBadge h={h} tr={ctx} className="px-3 py-1 text-xs" />
          <ReportProblemDialog orgId={ctx.org.id} machines={opts.machineOptions} projects={opts.projectOptions} categories={opts.problemCategories}
            machineProjects={machineProjects} defaultMachineId={id} defaultProjectId={m.current_project_id} />
          {canStatus && <ChangeStatusDialog machineId={id} status={m.status} />}
          {canManage && (
            <EditMachineDialog countries={opts.countryOptions} fuelTypes={opts.fuelTypes}
              values={{ ...m, id, engine_hours: m.engine_hours, service_interval_hours: m.service_interval_hours }} />
          )}
          {canManage && (
            <ActionButton action={archiveMachine.bind(null, id)} variant="ghost" confirm={ctx.t("machines.archiveConfirm")}><Archive className="h-4 w-4" /> {ctx.t("common.archive")}</ActionButton>
          )}
        </>}
      />
      <TabNav active={tab} items={TABS.map((k) => ({ key: k, label: ctx.t(`machines.tabs.${k}`), href: `${path}?tab=${k}`, count: k === "repairs" ? openRepairs.length : null }))} />

      {tab === "overview" && <OverviewTab ctx={ctx} m={m} h={h} tz={tz} openRepairs={openRepairs.length} since={openAssignRes.data?.started_at ?? null} />}
      {tab === "assignments" && <AssignmentsTab ctx={ctx} m={m} tz={tz} on={sp.on} employees={opts.employeeOptions} projects={opts.projectOptions} canManage={canManage} />}
      {tab === "fuel" && <FuelTab ctx={ctx} machineId={id} tz={tz} />}
      {tab === "maintenance" && (
        <MaintenanceTab ctx={ctx} m={m} canWrite={ctx.canAny("manage_machines", "manage_repairs")} employees={opts.employeeOptions} currency={defaultCurrency} today={today} />
      )}
      {tab === "repairs" && <RepairsTab ctx={ctx} machineId={id} />}
      {tab === "costs" && <CostsTab ctx={ctx} machineId={id} />}
      {tab === "documents" && <DocsTab ctx={ctx} machineId={id} canUpload={canManage} />}
      {tab === "activity" && <Card><CardBody className="pt-5"><Activity ctx={ctx} entity="machines" entityId={id} /></CardBody></Card>}
    </>
  );
}

/* ------------------------------------------------------------------ overview */
function ExpiryValue({ ctx, date }: { ctx: OrgContext; date: string | null }) {
  if (!date) return <>—</>;
  const b = expiryBucket(date);
  return <span className="inline-flex items-center gap-2">{fmtDate(date)}{b.key !== "ok" && <Badge tone={b.tone}>{ctx.label("documents.expiring", b.key)}</Badge>}</span>;
}

async function OverviewTab({ ctx, m, h, tz, openRepairs, since }: { ctx: OrgContext; m: Machine; h: HealthResult; tz: string; openRepairs: number; since: string | null }) {
  const canGps = ctx.canAny("view_gps", "view_live_gps", "view_gps_history");
  const [posRes, lastRepairRes, deviceRes, maponRes] = await Promise.all([
    canGps ? ctx.supabase.from("machine_latest_positions").select("recorded_at, latitude, longitude, speed_kmh, ignition, source").eq("machine_id", m.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("repair_requests").select("id, title, created_at, status").eq("machine_id", m.id).eq("organization_id", ctx.org.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.can("view_gps") ? ctx.supabase.from("gps_devices").select("provider, label, external_id, status, last_seen_at").eq("machine_id", m.id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ctx.can("view_gps") ? ctx.supabase.from("mapon_devices").select("label, number, last_update, connected").eq("machine_id", m.id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const pos = posRes.data;
  const device = deviceRes.data;
  const mapon = maponRes.data;
  const gpsLabel = mapon ? `Mapon · ${mapon.label ?? mapon.number ?? "—"}` : device ? `${device.provider === "mapon" ? "Mapon" : device.provider} · ${device.label ?? device.external_id ?? "—"}` : null;

  let marker: MapMarker | null = null;
  if (pos && pos.latitude != null && pos.longitude != null && pos.recorded_at) {
    const stale = Date.now() - new Date(pos.recorded_at).getTime() > 60 * 60 * 1000;
    marker = {
      id: m.id, kind: "machine", lat: Number(pos.latitude), lng: Number(pos.longitude), title: m.name, href: `/machines/${m.id}`,
      subtitle: ctx.label("machines.categories", m.category), stale, lastUpdate: fmtDateTime(pos.recorded_at, tz),
      status: m.status === "broken" ? "critical" : stale ? "offline" : h.health === "overdue" || h.health === "critical" || m.status === "maintenance" ? "attention" : pos.ignition ? "active" : "offline",
      lines: [
        [ctx.t("map.operator"), m.operator?.full_name ?? "—"],
        [ctx.t("common.project"), m.project?.code ?? "—"],
        [ctx.t("map.engineHours"), m.engine_hours != null ? `${fmtNumber(m.engine_hours)} h` : "—"],
      ],
    };
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={ctx.t("machines.engineHours")} value={m.engine_hours != null ? `${fmtNumber(m.engine_hours, 1)} h` : "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("machines.mileage")} value={m.mileage_km != null ? `${fmtNumber(m.mileage_km)} km` : "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("machines.remaining")} value={h.remaining != null ? `${fmtNumber(h.remaining)} h` : "—"} hint={h.daysLeft != null ? ctx.t("machines.daysLeft", { n: h.daysLeft }) : undefined} /></Card>
        <Card className="p-4"><Stat label={ctx.t("machines.openRepairs")} value={openRepairs} hint={lastRepairRes.data ? `${ctx.t("maintenance.lastRepair")}: ${fmtDate(lastRepairRes.data.created_at, tz)}` : undefined} /></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader title={ctx.t("machines.specs")} icon={<Gauge className="h-4 w-4" />} />
          <CardBody>
            <DefinitionList items={[
              { label: ctx.t("common.category"), value: ctx.label("machines.categories", m.category) },
              { label: ctx.t("machines.internalCode"), value: m.internal_code },
              { label: ctx.t("machines.manufacturer"), value: m.manufacturer },
              { label: ctx.t("machines.model"), value: m.model },
              { label: ctx.t("machines.year"), value: m.year },
              { label: ctx.t("machines.vin"), value: m.vin ? <span className="font-mono text-xs">{m.vin}</span> : null },
              { label: ctx.t("machines.registration"), value: m.registration_number },
              { label: ctx.t("common.country"), value: ctx.countries.find((c) => c.id === m.country_id)?.name },
              { label: ctx.t("machines.fuelType"), value: m.fuel_type ? ctx.label("fuel.types", m.fuel_type) : null },
              { label: ctx.t("machines.serviceInterval"), value: m.service_interval_hours != null ? `${fmtNumber(m.service_interval_hours)} h` : null },
              { label: ctx.t("machines.insurance"), value: <ExpiryValue ctx={ctx} date={m.insurance_valid_until} /> },
              { label: ctx.t("machines.inspection"), value: <ExpiryValue ctx={ctx} date={m.inspection_valid_until} /> },
              ...(ctx.can("view_gps") ? [{ label: ctx.t("machines.gpsDevice"), value: gpsLabel ?? ctx.t("machines.noGpsDevice") }] : []),
            ]} />
            {m.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{m.notes}</p>}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("machines.serviceHealth")} icon={<Wrench className="h-4 w-4" />} action={<HealthBadge h={h} tr={ctx} />} />
            <CardBody className="space-y-4">
              <ServiceMeter h={h} tr={ctx} />
              <DefinitionList items={[
                { label: ctx.t("machines.lastService"), value: m.last_service_at ? `${fmtDate(m.last_service_at)}${m.last_service_hours != null ? ` · ${fmtNumber(m.last_service_hours)} h` : ""}` : null },
                { label: ctx.t("machines.nextService"), value: [m.next_service_at ? fmtDate(m.next_service_at) : null, h.nextHours != null ? `${fmtNumber(h.nextHours)} h` : null].filter(Boolean).join(" · ") || null },
              ]} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("machines.currentUse")} icon={<User className="h-4 w-4" />}
              action={<Link href={`/machines/${m.id}?tab=assignments`} className="text-xs text-amber hover:underline">{ctx.t("machines.whoOperated")}</Link>} />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={m.operator?.full_name} size={40} />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted">{ctx.t("machines.currentOperator")}</div>
                  {m.operator ? (
                    <Link href={`/employees/${m.operator.id}`} className="block truncate font-medium hover:text-amber">{m.operator.full_name}</Link>
                  ) : <span className="text-sm text-muted">{ctx.t("machines.noOperator")}</span>}
                  {since && <div className="text-xs text-faint">{ctx.t("machines.since", { date: fmtDateTime(since, tz) })}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-moss" />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted">{ctx.t("machines.currentProject")}</div>
                  {m.project ? (
                    <Link href={`/projects/${m.project.id}`} className="block truncate text-sm font-medium hover:text-amber">{m.project.code} · {m.project.name}</Link>
                  ) : <span className="text-sm text-muted">—</span>}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {canGps && (
        <Card className="overflow-hidden">
          <CardHeader title={ctx.t("machines.position")} icon={<Satellite className="h-4 w-4" />}
            subtitle={pos?.recorded_at ? `${ctx.t("map.lastUpdate")}: ${fmtDateTime(pos.recorded_at, tz)}` : undefined}
            action={marker?.stale ? <Badge tone="warn">{ctx.t("map.stale")}</Badge> : undefined} />
          <div className="px-3 pb-3">
            {marker ? <LiveMap markers={[marker]} height={320} controls={false} /> : <EmptyState icon={<Satellite className="h-6 w-6" />} title={ctx.t("map.noPosition")} text={gpsLabel ? undefined : ctx.t("machines.noGpsDevice")} />}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ assignments: "Kurš vadīja tehniku?" */
async function AssignmentsTab({ ctx, m, tz, on, employees, projects, canManage }: {
  ctx: OrgContext; m: Machine; tz: string; on?: string; employees: { value: string; label: string }[]; projects: { value: string; label: string }[]; canManage: boolean;
}) {
  const day = on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null;
  let q = ctx.supabase.from("machine_assignments")
    .select("id, started_at, ended_at, source, employee:employees(id, full_name, job_title), project:projects(id, code)")
    .eq("machine_id", m.id).eq("organization_id", ctx.org.id).order("started_at", { ascending: false }).limit(200);
  if (day) {
    const start = zonedMidnightUtc(day, tz).toISOString();
    const end = zonedMidnightUtc(addDays(day, 1), tz).toISOString();
    q = q.lt("started_at", end).or(`ended_at.is.null,ended_at.gt.${start}`);
  }
  const { data } = await q;
  type Row = NonNullable<typeof data>[number];
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader title={ctx.t("machines.whoOperated")} subtitle={ctx.t("machines.assignmentsHint")} icon={<History className="h-4 w-4" />}
        action={canManage && <AssignOperatorDialog machineId={m.id} employees={employees} projects={projects} defaultProjectId={m.current_project_id} nowLocal={utcToLocalInput(new Date().toISOString(), ctx.timezone)} />} />
      <CardBody className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" action={`/machines/${m.id}`}>
          <input type="hidden" name="tab" value="assignments" />
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted">
            {ctx.t("machines.operatedOn")}
            <input type="date" name="on" defaultValue={day ?? ""} max={todayIn(tz)} className="field h-10 w-auto" />
          </label>
          <button type="submit" className={buttonClass("secondary", "md")}>{ctx.t("common.search")}</button>
          {day && <Link href={`/machines/${m.id}?tab=assignments`} className={buttonClass("ghost", "md")}>{ctx.t("common.clear")}</Link>}
        </form>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id}
          empty={<EmptyState icon={<History className="h-6 w-6" />} title={day ? ctx.t("machines.nobodyOnDay", { date: fmtDate(day) }) : ctx.t("machines.noAssignments")} />}
          columns={[
            { key: "e", header: ctx.t("common.employee"), cell: (r) => r.employee ? (
              <span className="flex items-center gap-2"><Avatar name={r.employee.full_name} size={26} /><Link href={`/employees/${r.employee.id}`} className="hover:text-amber">{r.employee.full_name}</Link></span>
            ) : "—" },
            { key: "p", header: ctx.t("common.project"), cell: (r) => r.project ? <Link href={`/projects/${r.project.id}`} className="hover:text-amber">{r.project.code}</Link> : "—" },
            { key: "s", header: ctx.t("common.from"), cell: (r) => fmtDateTime(r.started_at, tz) },
            { key: "en", header: ctx.t("common.to"), cell: (r) => r.ended_at ? fmtDateTime(r.ended_at, tz) : <Badge tone="ok" dot pulse>{ctx.t("machines.inUse")}</Badge> },
            { key: "d", header: ctx.t("machines.duration"), cell: (r) => fmtHours(hoursBetween(r.started_at, r.ended_at)), align: "right", hideOnMobile: true },
            { key: "src", header: ctx.t("machines.source"), cell: (r) => ctx.label("machines.assignmentSource", r.source), hideOnMobile: true },
            ...(canManage ? [{ key: "a", header: "", align: "right" as const, cell: (r: Row) => !r.ended_at ? (
              <ActionButton action={endAssignment.bind(null, r.id, m.id)} size="xs" variant="ghost" confirm={`${ctx.t("machines.endUsage")}?`}>{ctx.t("machines.endUsage")}</ActionButton>
            ) : null }] : []),
          ]} />
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ fuel */
async function FuelTab({ ctx, machineId, tz }: { ctx: OrgContext; machineId: string; tz: string }) {
  const { data } = await ctx.supabase.from("fuel_logs")
    .select("id, occurred_at, litres, total_amount, currency, engine_hours, fuel_type, location_text, machine_id, employee:employees(id, full_name), machine:machines(id, name), project:projects(id, code)")
    .eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("deleted_at", null).order("occurred_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  const litres = rows.reduce((a, r) => a + Number(r.litres), 0);
  const cost = sumByCurrency(rows, (r) => r.total_amount, (r) => r.currency);
  const cons = consumptionByMachine(rows).get(machineId);
  const eurCost = cost.EUR;
  const perHour = cons?.lph != null && eurCost && litres > 0 ? (eurCost / litres) * cons.lph : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={ctx.t("fuel.litres")} value={`${fmtNumber(litres, 0)} L`} hint={ctx.t("fuel.records", { n: rows.length })} /></Card>
        <Card className="p-4"><Stat label={ctx.t("fuel.totalAmount")} value={fmtMoneyMap(cost) ?? "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("fuel.lPerHour")} value={cons?.lph != null ? `${fmtNumber(cons.lph, 1)} L/h` : ctx.t("common.notEnoughData")} hint={cons?.lph != null ? ctx.t("fuel.measuredOver", { h: fmtNumber(cons.hours, 0) }) : ctx.t("fuel.needEngineHours")} /></Card>
        <Card className="p-4"><Stat label={ctx.t("fuel.costPerHour")} value={perHour != null ? fmtMoney(perHour, "EUR") : "—"} /></Card>
      </div>
      <div className="flex justify-end">
        <Link href={`/fuel?new=1&machine=${machineId}`} className={buttonClass("secondary", "sm")}><Fuel className="h-4 w-4" /> {ctx.t("fuel.new")}</Link>
      </div>
      <FuelTable rows={rows as FuelRow[]} tr={ctx} tz={tz} />
    </div>
  );
}

/* ------------------------------------------------------------------ maintenance */
async function MaintenanceTab({ ctx, m, canWrite, employees, currency, today }: {
  ctx: OrgContext; m: Machine; canWrite: boolean; employees: { value: string; label: string }[]; currency: string; today: string;
}) {
  const { data } = await ctx.supabase.from("maintenance_records")
    .select("id, performed_at, maintenance_type, engine_hours, description, cost, currency, external_service, next_service_hours, performer:employees(full_name)")
    .eq("machine_id", m.id).eq("organization_id", ctx.org.id).is("deleted_at", null).order("performed_at", { ascending: false }).limit(200);
  type Row = NonNullable<typeof data>[number];
  const rows = data ?? [];
  const total = sumByCurrency(rows, (r) => r.cost, (r) => r.currency);
  return (
    <Card>
      <CardHeader title={ctx.t("machines.tabs.maintenance")} icon={<CalendarClock className="h-4 w-4" />}
        subtitle={`${ctx.t("maintenance.totalCost")}: ${fmtMoneyMap(total) ?? "—"}`}
        action={canWrite && <AddMaintenanceDialog machineId={m.id} employees={employees} defaultCurrency={currency} defaultEngineHours={m.engine_hours} today={today} compact />} />
      <CardBody>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id}
          empty={<EmptyState icon={<CalendarClock className="h-6 w-6" />} title={ctx.t("maintenance.empty")} />}
          columns={[
            { key: "d", header: ctx.t("common.date"), cell: (r) => fmtDate(r.performed_at) },
            { key: "t", header: ctx.t("common.type"), cell: (r) => <Badge tone={r.maintenance_type === "service" ? "forest" : "neutral"}>{ctx.label("maintenance.type", r.maintenance_type)}</Badge> },
            { key: "h", header: ctx.t("machines.engineHours"), cell: (r) => r.engine_hours != null ? `${fmtNumber(r.engine_hours)} h` : "—", align: "right" },
            { key: "desc", header: ctx.t("common.description"), cell: (r) => <span className="line-clamp-2 max-w-[320px]">{r.description ?? "—"}</span>, hideOnMobile: true },
            { key: "by", header: ctx.t("maintenance.performedBy"), cell: (r) => r.external_service ?? r.performer?.full_name ?? "—", hideOnMobile: true },
            { key: "c", header: ctx.t("maintenance.cost"), cell: (r) => fmtMoney(r.cost, r.currency), align: "right" },
          ]} />
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ repairs */
async function RepairsTab({ ctx, machineId }: { ctx: OrgContext; machineId: string }) {
  const { data } = await ctx.supabase.from("repair_requests")
    .select("id, title, priority, status, created_at, category, machine:machines(id, name), project:projects(code), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(full_name)")
    .eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  return <RepairTable rows={(data ?? []) as RepairRow[]} tr={ctx} tz={ctx.timezone} />;
}

/* ------------------------------------------------------------------ costs (per currency, never converted) */
async function CostsTab({ ctx, machineId }: { ctx: OrgContext; machineId: string }) {
  const [fuelRes, maintRes, repairsRes] = await Promise.all([
    ctx.supabase.from("fuel_logs").select("total_amount, currency, litres, engine_hours, occurred_at, machine_id").eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("deleted_at", null).limit(5000),
    ctx.supabase.from("maintenance_records").select("cost, currency").eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("deleted_at", null),
    ctx.supabase.from("repair_requests").select("id, labour_cost, external_cost, currency, downtime_hours, status, parts:repair_parts(quantity, unit_cost, currency)")
      .eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("deleted_at", null),
  ]);
  const fuel = sumByCurrency(fuelRes.data ?? [], (r) => r.total_amount, (r) => r.currency);
  const maint = sumByCurrency(maintRes.data ?? [], (r) => r.cost, (r) => r.currency);
  const repairs = repairsRes.data ?? [];
  const repairEntries: { amount: number; currency: string }[] = [];
  for (const r of repairs) {
    repairEntries.push({ amount: Number(r.labour_cost ?? 0) + Number(r.external_cost ?? 0), currency: r.currency });
    for (const p of r.parts ?? []) repairEntries.push({ amount: Number(p.quantity) * Number(p.unit_cost ?? 0), currency: p.currency });
  }
  const rep = sumByCurrency(repairEntries.filter((e) => e.amount > 0), (e) => e.amount, (e) => e.currency);
  const currencies = [...new Set([...Object.keys(fuel), ...Object.keys(maint), ...Object.keys(rep)])].sort((a, b) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)));
  const downtime = repairs.reduce((a, r) => a + Number(r.downtime_hours ?? 0), 0);
  const eh = (fuelRes.data ?? []).map((r) => r.engine_hours).filter((v): v is number => v != null).map(Number);
  const hoursUsed = eh.length >= 2 ? Math.max(...eh) - Math.min(...eh) : null;
  const eurTotal = (fuel.EUR ?? 0) + (maint.EUR ?? 0) + (rep.EUR ?? 0);
  type Row = { currency: string; fuel: number; maint: number; rep: number };
  const rows: Row[] = currencies.map((c) => ({ currency: c, fuel: fuel[c] ?? 0, maint: maint[c] ?? 0, rep: rep[c] ?? 0 }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={ctx.t("machines.totalOperatingCost")} value={fmtMoneyMap(Object.fromEntries(rows.map((r) => [r.currency, r.fuel + r.maint + r.rep]))) ?? "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("machines.costPerEngineHour")} value={hoursUsed && hoursUsed > 0 && eurTotal > 0 && currencies.length === 1 && currencies[0] === "EUR" ? fmtMoney(eurTotal / hoursUsed, "EUR") : "—"}
          hint={hoursUsed ? ctx.t("fuel.measuredOver", { h: fmtNumber(hoursUsed, 0) }) : ctx.t("fuel.needEngineHours")} /></Card>
        <Card className="p-4"><Stat label={ctx.t("machines.repairsCount")} value={repairs.length} /></Card>
        <Card className="p-4"><Stat label={ctx.t("repairs.downtime")} value={downtime > 0 ? fmtHours(downtime) : "—"} /></Card>
      </div>
      <DataTable<Row> rows={rows} rowKey={(r) => r.currency}
        empty={<EmptyState icon={<Timer className="h-6 w-6" />} title={ctx.t("common.noData")} />}
        columns={[
          { key: "c", header: ctx.t("common.currency"), cell: (r) => <span className="font-medium">{r.currency}</span> },
          { key: "f", header: ctx.t("nav.fuel"), cell: (r) => fmtMoney(r.fuel, r.currency), align: "right" },
          { key: "m", header: ctx.t("machines.tabs.maintenance"), cell: (r) => fmtMoney(r.maint, r.currency), align: "right" },
          { key: "r", header: ctx.t("machines.tabs.repairs"), cell: (r) => fmtMoney(r.rep, r.currency), align: "right" },
          { key: "t", header: ctx.t("common.total"), cell: (r) => <span className="font-semibold text-ink">{fmtMoney(r.fuel + r.maint + r.rep, r.currency)}</span>, align: "right" },
        ]} />
      <p className="text-xs text-faint">{ctx.t("machines.costsNote")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ documents */
async function DocsTab({ ctx, machineId, canUpload }: { ctx: OrgContext; machineId: string; canUpload: boolean }) {
  const [docs, files] = await Promise.all([
    ctx.supabase.from("documents").select("id, name, document_type, expiry_date, version, status, entity_type, uploaded_at, file_id")
      .eq("organization_id", ctx.org.id).eq("entity_type", "machine").eq("entity_id", machineId).order("uploaded_at", { ascending: false }),
    loadFiles(ctx, "machine", machineId),
  ]);
  return (
    <div className="space-y-6">
      <DocumentTable rows={(docs.data ?? []) as DocRow[]} tr={ctx} />
      <Card>
        <CardHeader title={ctx.t("common.photos")}
          action={canUpload && <div className="w-44"><FileUploader orgId={ctx.org.id} entityType="machine" entityId={machineId} compact accept="image/*,video/*,application/pdf" /></div>} />
        <CardBody><FileGallery files={files} tz={ctx.timezone} empty={ctx.t("common.noData")} /></CardBody>
      </Card>
    </div>
  );
}
