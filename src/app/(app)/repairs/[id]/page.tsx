import type { Metadata } from "next";
import { BadgeCheck, Ban, Camera, CircleDot, Clock, ExternalLink, Hourglass, MapPin, Play, RotateCcw, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Activity } from "@/components/shared/activity";
import { Comments } from "@/components/shared/comments";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge, DemoBadge } from "@/components/ui/badge";
import type { ButtonVariant } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DefinitionList, Stat } from "@/components/ui/card";
import { ActionButton, type Option } from "@/components/ui/form";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg, type OrgContext } from "@/lib/context";
import { fmtDateTime, fmtHours, fmtMoney, fmtMoneyMap, fmtNumber, hoursBetween } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { cn, priorityTone, statusTone } from "@/lib/utils";
import { sumByCurrency } from "../../fuel/stats";
import { CategoryIcon } from "../../machines/ui";
import { approveRepair, changeRepairStatus, removeRepairPart } from "../actions";
import { AddPartDialog, AssignMechanicDialog, RepairWorkDialog } from "../components";
import { isRepairStatus, looksLikeMechanic, REPAIR_TRANSITIONS, type RepairStatus } from "../workflow";

export const metadata: Metadata = { title: "Remonts" };

const MAIN_PATH: RepairStatus[] = ["new", "acknowledged", "assigned", "in_progress", "completed"];
const ACTION_STYLE: Partial<Record<RepairStatus, { icon: ReactNode; variant: ButtonVariant }>> = {
  acknowledged: { icon: <CircleDot className="h-4 w-4" />, variant: "secondary" },
  assigned: { icon: <CircleDot className="h-4 w-4" />, variant: "secondary" },
  in_progress: { icon: <Play className="h-4 w-4" />, variant: "primary" },
  waiting_parts: { icon: <Hourglass className="h-4 w-4" />, variant: "secondary" },
  external_service: { icon: <Truck className="h-4 w-4" />, variant: "secondary" },
  cancelled: { icon: <Ban className="h-4 w-4" />, variant: "danger" },
  new: { icon: <RotateCcw className="h-4 w-4" />, variant: "secondary" },
};

async function loadRepair(ctx: OrgContext, id: string) {
  const { data } = await ctx.supabase.from("repair_requests")
    .select("*, machine:machines(id, name, category, status, engine_hours, internal_code), project:projects(id, code, name), reporter:employees!repair_requests_reported_by_employee_id_fkey(id, full_name), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(id, full_name, job_title)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  return data;
}

export default async function RepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const r = await loadRepair(ctx, id);
  if (!r) notFound();

  const tz = ctx.timezone;
  const path = `/repairs/${id}`;
  const status: RepairStatus = isRepairStatus(r.status) ? r.status : "new";
  const canWork = ctx.canAny("manage_repairs", "approve_repairs");
  const isMechanic = !!ctx.employee?.id && r.assigned_mechanic_id === ctx.employee.id;
  const canParts = ctx.can("manage_repairs") || isMechanic;
  const closed = status === "completed" || status === "cancelled";

  const [partsRes, historyRes, files, mechanicOptions] = await Promise.all([
    ctx.supabase.from("repair_parts").select("id, name, part_number, quantity, unit_cost, currency, supplier, created_at").eq("repair_id", id).order("created_at"),
    ctx.supabase.from("repair_status_history").select("id, from_status, to_status, changed_by, changed_at, comment").eq("repair_id", id).order("changed_at"),
    loadFiles(ctx, "repair", id),
    canWork ? buildMechanicOptions(ctx) : Promise.resolve([] as Option[]),
  ]);
  const parts = partsRes.data ?? [];
  const history = historyRes.data ?? [];
  const userIds = [...new Set([...history.map((h) => h.changed_by), r.approved_by].filter((x): x is string => !!x))];
  const { data: profiles } = userIds.length
    ? await ctx.supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const before = files.filter((f) => f.kind === "before" || f.kind === "photo" || f.kind === "video");
  const after = files.filter((f) => f.kind === "after");
  const otherFiles = files.filter((f) => !["before", "after", "photo", "video"].includes(f.kind));

  const partsTotal = sumByCurrency(parts, (p) => (p.unit_cost != null ? Number(p.quantity) * Number(p.unit_cost) : null), (p) => p.currency);
  const labourExternal = sumByCurrency([
    { a: r.labour_cost, c: r.currency }, { a: r.external_cost, c: r.currency },
  ], (x) => x.a, (x) => x.c);
  const total: Record<string, number> = { ...labourExternal };
  for (const [c, v] of Object.entries(partsTotal)) total[c] = Math.round(((total[c] ?? 0) + v) * 100) / 100;
  const liveDowntime = r.downtime_hours == null && r.machine_down_since && !closed ? hoursBetween(r.machine_down_since, null) : null;
  const categoryLabel = ctx.label("repairs.categories", r.category, (await getOptions(ctx)).problemCategories.find((c) => c.value === r.category)?.label ?? r.category);
  const transitions = REPAIR_TRANSITIONS[status].filter((to) => !(to === "assigned" && !r.assigned_mechanic_id));
  const workValues = {
    labour_hours: r.labour_hours, labour_cost: r.labour_cost, external_cost: r.external_cost, currency: r.currency,
    downtime_hours: r.downtime_hours, external_service: r.external_service, resolution: r.resolution,
  };
  type PartRow = (typeof parts)[number];

  return (
    <>
      <PageHeader
        back={{ href: "/maintenance", label: ctx.t("maintenance.title") }}
        eyebrow={<><span>{categoryLabel}</span><span>·</span><span>{fmtDateTime(r.created_at, tz)}</span>{r.is_demo && <DemoBadge />}</>}
        title={r.title}
        subtitle={r.machine ? (
          <Link href={`/machines/${r.machine.id}?tab=repairs`} className="inline-flex items-center gap-2 hover:text-amber">
            <CategoryIcon category={r.machine.category} size="sm" /> {r.machine.name}{r.project ? ` · ${r.project.code}` : ""}
          </Link>
        ) : undefined}
        actions={<>
          <Badge tone={priorityTone(r.priority)} dot pulse={r.priority === "critical" && !closed} className="px-3 py-1 text-xs">{ctx.label("repairs.priority", r.priority)}</Badge>
          <Badge tone={statusTone(r.status)} className="px-3 py-1 text-xs">{ctx.label("repairs.status", r.status)}</Badge>
          {r.approved_at && <Badge tone="ok" className="px-3 py-1 text-xs"><BadgeCheck className="h-3.5 w-3.5" /> {ctx.t("repairs.approved")}</Badge>}
        </>}
      />

      {/* workflow */}
      <Card className="mb-6 overflow-hidden">
        <CardBody className="pt-5">
          <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={ctx.t("repairs.workflow")}>
            {MAIN_PATH.map((s, i) => {
              const idx = MAIN_PATH.indexOf(status);
              const reached = status === "cancelled" ? false : idx >= 0 ? i <= idx : i <= 3;
              const current = s === status;
              return (
                <li key={s} className="flex shrink-0 items-center gap-1">
                  {i > 0 && <span className={cn("h-px w-5 sm:w-10", reached ? "bg-forest-400" : "bg-line-strong")} />}
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    current ? "border-amber bg-amber/15 text-ink" : reached ? "border-forest-500/50 bg-forest-800/40 text-moss" : "border-line text-faint")}>
                    {ctx.label("repairs.status", s)}
                  </span>
                </li>
              );
            })}
            {(status === "waiting_parts" || status === "external_service" || status === "cancelled") && (
              <li className="ml-2 shrink-0"><Badge tone={statusTone(status === "cancelled" ? "cancelled" : status)} dot pulse={status !== "cancelled"}>{ctx.label("repairs.status", status)}</Badge></li>
            )}
          </ol>

          {canWork && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {transitions.map((to) => {
                if (to === "completed") return <RepairWorkDialog key={to} repairId={id} values={workValues} complete downtimeAuto={!!r.machine_down_since} />;
                if (status === "completed" && to === "in_progress" && r.approved_at) return null;
                const style = status === "completed" ? { icon: <RotateCcw className="h-4 w-4" />, variant: "secondary" as const } : ACTION_STYLE[to] ?? { icon: null, variant: "secondary" as const };
                return (
                  <ActionButton key={to} action={changeRepairStatus.bind(null, id)} fields={{ status: to }} size="md" variant={style.variant}
                    confirm={to === "cancelled" ? `${ctx.t("repairs.actions.cancelled")}?` : undefined} className="min-h-11">
                    {style.icon} {status === "completed" ? ctx.t("repairs.reopen") : ctx.t(`repairs.actions.${to}`)}
                  </ActionButton>
                );
              })}
              {!closed && <AssignMechanicDialog repairId={id} options={mechanicOptions} current={r.assigned_mechanic_id} />}
              {ctx.can("approve_repairs") && status === "completed" && !r.approved_at && (
                <ActionButton action={approveRepair.bind(null, id)} variant="amber" size="md" className="min-h-11" confirm={`${ctx.t("repairs.approve")}?`}>
                  <BadgeCheck className="h-4 w-4" /> {ctx.t("repairs.approve")}
                </ActionButton>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("common.details")} icon={<Wrench className="h-4 w-4" />} />
            <CardBody>
              {r.description && <p className="mb-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{r.description}</p>}
              <DefinitionList items={[
                { label: ctx.t("repairs.problemCategory"), value: categoryLabel },
                { label: ctx.t("repairs.reporter"), value: r.reporter ? <Link href={`/employees/${r.reporter.id}`} className="hover:text-amber">{r.reporter.full_name}</Link> : null },
                { label: ctx.t("common.createdAt"), value: fmtDateTime(r.created_at, tz) },
                { label: ctx.t("common.project"), value: r.project ? <Link href={`/projects/${r.project.id}`} className="hover:text-amber">{r.project.code} · {r.project.name}</Link> : null },
                { label: ctx.t("common.location"), value: r.location_text || (r.latitude != null && r.longitude != null ? (
                  <a href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=15/${r.latitude}/${r.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-amber">
                    <MapPin className="h-3.5 w-3.5" />{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}<ExternalLink className="h-3 w-3" />
                  </a>
                ) : null) },
                { label: ctx.t("repairs.machineDownSince"), value: r.machine_down_since ? fmtDateTime(r.machine_down_since, tz) : null },
                { label: ctx.t("repairs.completedAt"), value: r.completed_at ? fmtDateTime(r.completed_at, tz) : null },
                { label: ctx.t("repairs.approvedBy"), value: r.approved_at ? `${names.get(r.approved_by ?? "") ?? "—"} · ${fmtDateTime(r.approved_at, tz)}` : null },
              ]} />
              {r.resolution && (
                <div className="mt-4">
                  <div className="mb-1 text-xs uppercase tracking-wider text-muted">{ctx.t("repairs.resolution")}</div>
                  <p className="whitespace-pre-wrap rounded-xl border border-forest-600/40 bg-forest-800/20 p-3 text-sm text-ink-2">{r.resolution}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* before / after photos */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title={ctx.t("repairs.before")} icon={<Camera className="h-4 w-4" />}
                action={<div className="w-40"><FileUploader orgId={ctx.org.id} entityType="repair" entityId={id} kind="before" compact accept="image/*,video/*" label={ctx.t("common.add")} /></div>} />
              <CardBody><FileGallery files={before} tz={tz} empty={ctx.t("repairs.noPhotos")} /></CardBody>
            </Card>
            <Card>
              <CardHeader title={ctx.t("repairs.after")} icon={<Camera className="h-4 w-4" />}
                action={(canWork || isMechanic) && <div className="w-40"><FileUploader orgId={ctx.org.id} entityType="repair" entityId={id} kind="after" compact accept="image/*,video/*" label={ctx.t("common.add")} /></div>} />
              <CardBody><FileGallery files={after} tz={tz} empty={ctx.t("repairs.noPhotos")} /></CardBody>
            </Card>
          </div>
          {(otherFiles.length > 0 || canWork || isMechanic) && (
            <Card>
              <CardHeader title={ctx.t("repairs.invoices")} subtitle={ctx.t("repairs.invoicesHint")}
                action={(canWork || isMechanic) && <div className="w-40"><FileUploader orgId={ctx.org.id} entityType="repair" entityId={id} kind="document" bucket="documents" compact accept="image/*,application/pdf" label={ctx.t("common.upload")} /></div>} />
              <CardBody><FileGallery files={otherFiles} tz={tz} empty={ctx.t("common.noData")} /></CardBody>
            </Card>
          )}

          {/* parts */}
          <Card>
            <CardHeader title={ctx.t("repairs.parts")} subtitle={fmtMoneyMap(partsTotal) ?? undefined}
              action={canParts && !closed && <AddPartDialog repairId={id} defaultCurrency={r.currency} />} />
            <CardBody>
              <DataTable<PartRow> rows={parts} rowKey={(p) => p.id}
                empty={<p className="py-3 text-sm text-muted">{ctx.t("repairs.noParts")}</p>}
                columns={[
                  { key: "n", header: ctx.t("repairs.partName"), cell: (p) => <span className="font-medium">{p.name}</span> },
                  { key: "no", header: ctx.t("repairs.partNumber"), cell: (p) => p.part_number ? <span className="font-mono text-xs">{p.part_number}</span> : "—", hideOnMobile: true },
                  { key: "s", header: ctx.t("repairs.supplier"), cell: (p) => p.supplier ?? "—", hideOnMobile: true },
                  { key: "q", header: ctx.t("repairs.quantity"), cell: (p) => fmtNumber(p.quantity, Number(p.quantity) % 1 ? 2 : 0), align: "right" },
                  { key: "u", header: ctx.t("repairs.unitCost"), cell: (p) => fmtMoney(p.unit_cost, p.currency), align: "right", hideOnMobile: true },
                  { key: "t", header: ctx.t("common.total"), cell: (p) => p.unit_cost != null ? fmtMoney(Number(p.quantity) * Number(p.unit_cost), p.currency) : "—", align: "right" },
                  ...(ctx.can("manage_repairs") && !closed ? [{ key: "x", header: "", align: "right" as const, cell: (p: PartRow) => (
                    <ActionButton action={removeRepairPart.bind(null, p.id, id)} variant="ghost" size="xs" confirm={`${ctx.t("common.delete")}: ${p.name}?`}>{ctx.t("common.delete")}</ActionButton>
                  ) }] : []),
                ]} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* mechanic */}
          <Card>
            <CardHeader title={ctx.t("repairs.mechanic")} />
            <CardBody>
              {r.mechanic ? (
                <div className="flex items-center gap-3">
                  <Avatar name={r.mechanic.full_name} size={40} />
                  <div className="min-w-0">
                    <Link href={`/employees/${r.mechanic.id}`} className="block truncate font-medium hover:text-amber">{r.mechanic.full_name}</Link>
                    <span className="block truncate text-xs text-muted">{r.mechanic.job_title ?? ""}{isMechanic ? ` · ${ctx.t("repairs.you")}` : ""}</span>
                  </div>
                </div>
              ) : <p className="text-sm text-muted">{ctx.t("repairs.unassigned")}</p>}
            </CardBody>
          </Card>

          {/* labour & costs */}
          <Card>
            <CardHeader title={ctx.t("repairs.workAndCosts")} action={canWork && <RepairWorkDialog repairId={id} values={workValues} downtimeAuto={!!r.machine_down_since} />} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label={ctx.t("repairs.labourHours")} value={r.labour_hours != null ? fmtHours(r.labour_hours) : "—"} />
                <Stat label={ctx.t("repairs.downtime")} value={r.downtime_hours != null ? fmtHours(r.downtime_hours) : liveDowntime != null ? fmtHours(liveDowntime) : "—"}
                  hint={liveDowntime != null ? ctx.t("repairs.downtimeOngoing") : undefined} />
                <Stat label={ctx.t("repairs.labourCost")} value={fmtMoney(r.labour_cost, r.currency)} />
                <Stat label={ctx.t("repairs.externalCost")} value={fmtMoney(r.external_cost, r.currency)} hint={r.external_service ?? undefined} />
                <Stat label={ctx.t("repairs.parts")} value={fmtMoneyMap(partsTotal) ?? "—"} className="col-span-2" />
              </div>
              <div className="flex items-baseline justify-between rounded-xl border border-amber/30 bg-amber/5 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">{ctx.t("repairs.totalCost")}</span>
                <span className="font-display text-xl font-bold tabular">{fmtMoneyMap(total) ?? "—"}</span>
              </div>
            </CardBody>
          </Card>

          {/* status history */}
          <Card>
            <CardHeader title={ctx.t("repairs.history")} icon={<Clock className="h-4 w-4" />} />
            <CardBody>
              {history.length ? (
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className={cn("absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg", h.to_status === "completed" ? "bg-ok" : h.to_status === "cancelled" ? "bg-off" : "bg-amber")} />
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        {h.from_status && <><Badge tone={statusTone(h.from_status)}>{ctx.label("repairs.status", h.from_status)}</Badge><span className="text-faint">→</span></>}
                        <Badge tone={statusTone(h.to_status)}>{ctx.label("repairs.status", h.to_status)}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted">{names.get(h.changed_by ?? "") ?? "—"} · {fmtDateTime(h.changed_at, tz)}</div>
                      {h.comment && <p className="mt-1 text-xs text-ink-2">{h.comment}</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={ctx.t("common.comments")} />
          <CardBody><Comments ctx={ctx} entityType="repair" entityId={id} path={path} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("common.activity")} />
          <CardBody><Activity ctx={ctx} entity="repair_requests" entityId={id} /></CardBody>
        </Card>
      </div>
    </>
  );
}

/** Mechanics first (job title or mechanic project role), then everyone else. */
async function buildMechanicOptions(ctx: OrgContext): Promise<Option[]> {
  const [opts, rolesRes] = await Promise.all([
    getOptions(ctx),
    ctx.supabase.from("project_workers").select("employee_id").eq("organization_id", ctx.org.id).eq("project_role", "mechanic").is("unassigned_at", null),
  ]);
  const byRole = new Set((rolesRes.data ?? []).map((r) => r.employee_id));
  const active = opts.employees.filter((e) => e.status !== "inactive");
  const mech = active.filter((e) => looksLikeMechanic(e.job_title) || byRole.has(e.id));
  const mechIds = new Set(mech.map((e) => e.id));
  const groupMech = ctx.t("repairs.mechanicsGroup");
  const groupOther = ctx.t("repairs.otherEmployeesGroup");
  return [
    ...mech.map((e) => ({ value: e.id, label: e.full_name ?? "—", group: groupMech })),
    ...active.filter((e) => !mechIds.has(e.id)).map((e) => ({ value: e.id, label: e.full_name ?? "—", group: groupOther })),
  ];
}
