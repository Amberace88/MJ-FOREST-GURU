import type { Metadata } from "next";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_TYPES } from "@/lib/constants";
import { Camera, Check, ClipboardList, History, MapPin, MessageSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { Comments } from "@/components/shared/comments";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { ActionButton, ActionForm, FormGrid, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { fmtDateTime } from "@/lib/format";
import { cn, one, severityTone, statusTone } from "@/lib/utils";
import { setIncidentStatus, updateIncidentResponse } from "../actions";

export const metadata: Metadata = { title: "Incidents" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IncidentDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { data: inc } = await ctx.supabase.from("incidents")
    .select("*, project:projects(id, code, name, timezone), machine:machines(id, name), employee:employees(id, full_name)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!inc) notFound();

  const project = one(inc.project);
  const machine = one(inc.machine);
  const employee = one(inc.employee);
  const tz = ctx.timezone;
  const canManage = ctx.canAny("manage_incidents", "manage_safety");
  const canUpload = canManage || inc.reported_by === ctx.user.id;
  const path = `/incidents/${id}`;

  const [files, reporterRes] = await Promise.all([
    loadFiles(ctx, "incident", id),
    inc.reported_by ? ctx.supabase.from("profiles").select("full_name").eq("id", inc.reported_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const reporter = reporterRes.data?.full_name ?? null;
  const currentIdx = INCIDENT_STATUSES.indexOf(inc.status as (typeof INCIDENT_STATUSES)[number]);
  const nextStatus = currentIdx >= 0 && currentIdx < INCIDENT_STATUSES.length - 1 ? INCIDENT_STATUSES[currentIdx + 1] : null;
  const mapHref = inc.latitude != null && inc.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${inc.latitude}&mlon=${inc.longitude}#map=16/${inc.latitude}/${inc.longitude}` : null;

  return (
    <>
      <PageHeader
        back={{ href: "/incidents", label: ctx.t("incidents.title") }}
        eyebrow={<><ShieldAlert className="h-3.5 w-3.5" /><span>{ctx.label("incidents.type", inc.incident_type)}</span>{inc.is_demo && <DemoBadge />}</>}
        title={inc.title}
        subtitle={`${ctx.t("incidents.occurredAt")}: ${fmtDateTime(inc.occurred_at, tz)}`}
        actions={<>
          <Badge tone={severityTone(inc.severity)} dot pulse={inc.severity === "critical" && !["resolved", "closed"].includes(inc.status)} className="px-3 py-1 text-xs">
            {ctx.t("incidents.severityLabel")}: {ctx.label("incidents.severity", inc.severity)}
          </Badge>
          <Badge tone={statusTone(inc.status)} className="px-3 py-1 text-xs">{ctx.label("incidents.status", inc.status)}</Badge>
        </>}
      />

      {/* Status workflow */}
      <Card className="mb-6">
        <CardHeader title={ctx.t("incidents.workflow")} icon={<ClipboardList className="h-4 w-4" />} />
        <CardBody>
          <ol className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {INCIDENT_STATUSES.map((s, i) => {
              const done = currentIdx > i;
              const current = currentIdx === i;
              return (
                <li key={s} className="flex min-w-[118px] flex-1 items-center gap-2">
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular",
                    done ? "border-ok/40 bg-ok/15 text-ok" : current ? "border-amber bg-amber/15 text-amber" : "border-line text-faint")}>
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-xs leading-tight", current ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted")}>{ctx.label("incidents.status", s)}</span>
                  {i < INCIDENT_STATUSES.length - 1 && <span className={cn("hidden h-px flex-1 sm:block", done ? "bg-ok/40" : "bg-line")} aria-hidden />}
                </li>
              );
            })}
          </ol>
          {canManage && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {nextStatus && (
                <ActionButton action={setIncidentStatus.bind(null, id, nextStatus)} variant="amber" size="md"
                  confirm={nextStatus === "closed" ? ctx.t("incidents.setStatus", { status: ctx.label("incidents.status", nextStatus) }) : undefined}>
                  {ctx.t("incidents.setStatus", { status: ctx.label("incidents.status", nextStatus) })}
                </ActionButton>
              )}
              {INCIDENT_STATUSES.filter((s) => s !== inc.status && s !== nextStatus).map((s) => (
                <ActionButton key={s} action={setIncidentStatus.bind(null, id, s)} variant="ghost" size="sm"
                  confirm={ctx.t("incidents.setStatus", { status: ctx.label("incidents.status", s) })}>
                  {ctx.label("incidents.status", s)}
                </ActionButton>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("incidents.details")} icon={<ShieldAlert className="h-4 w-4" />} />
            <CardBody className="space-y-5">
              <DefinitionList items={[
                { label: ctx.t("incidents.occurredAt"), value: fmtDateTime(inc.occurred_at, tz) },
                { label: ctx.t("incidents.typeLabel"), value: ctx.label("incidents.type", inc.incident_type) },
                { label: ctx.t("common.project"), value: project ? <Link href={`/projects/${project.id}`} className="hover:text-amber">{project.code} · {project.name}</Link> : null },
                { label: ctx.t("common.machine"), value: machine ? <Link href={`/machines/${machine.id}`} className="hover:text-amber">{machine.name}</Link> : null },
                { label: ctx.t("incidents.involvedEmployee"), value: employee?.full_name ?? null },
                { label: ctx.t("incidents.location"), value: inc.location_text },
                { label: ctx.t("common.coordinates"), value: mapHref ? (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-amber">
                    <MapPin className="h-3.5 w-3.5" /> {inc.latitude?.toFixed(5)}, {inc.longitude?.toFixed(5)}
                  </a>) : null },
                { label: ctx.t("incidents.reportedBy"), value: reporter },
                { label: ctx.t("incidents.reportedAt"), value: fmtDateTime(inc.created_at, tz) },
                ...(inc.closed_at ? [{ label: ctx.t("incidents.closedAt"), value: fmtDateTime(inc.closed_at, tz) }] : []),
              ]} />
              <TextBlock label={ctx.t("incidents.description")} text={inc.description} />
              <TextBlock label={ctx.t("incidents.immediateAction")} text={inc.immediate_action} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("common.photos")} icon={<Camera className="h-4 w-4" />}
              action={canUpload && <div className="w-44"><FileUploader orgId={ctx.org.id} entityType="incident" entityId={id} compact accept="image/*,video/*" /></div>} />
            <CardBody><FileGallery files={files} tz={tz} empty={ctx.t("common.noData")} /></CardBody>
          </Card>

          <Card>
            <CardHeader title={ctx.t("common.comments")} icon={<MessageSquare className="h-4 w-4" />} />
            <CardBody><Comments ctx={ctx} entityType="incident" entityId={id} path={path} /></CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("incidents.managerSection")} subtitle={canManage ? undefined : ctx.t("incidents.managerOnly")} icon={<ClipboardList className="h-4 w-4" />} />
            <CardBody>
              {canManage ? (
                <ActionForm action={updateIncidentResponse.bind(null, id)} className="space-y-4">
                  <FormGrid>
                    <Select name="severity" label={ctx.t("incidents.severityLabel")} defaultValue={inc.severity}
                      options={INCIDENT_SEVERITIES.map((s) => ({ value: s, label: ctx.label("incidents.severity", s) }))} />
                    <Select name="incident_type" label={ctx.t("incidents.typeLabel")} defaultValue={inc.incident_type}
                      options={INCIDENT_TYPES.map((s) => ({ value: s, label: ctx.label("incidents.type", s) }))} />
                  </FormGrid>
                  <Textarea name="manager_response" label={ctx.t("incidents.managerResponse")} defaultValue={inc.manager_response ?? ""} rows={3} maxLength={5000} optional />
                  <Textarea name="investigation" label={ctx.t("incidents.investigation")} defaultValue={inc.investigation ?? ""} rows={4} maxLength={5000} optional />
                  <Textarea name="corrective_action" label={ctx.t("incidents.correctiveAction")} defaultValue={inc.corrective_action ?? ""} rows={3} maxLength={5000} optional />
                  <div className="flex justify-end"><SubmitButton>{ctx.t("common.save")}</SubmitButton></div>
                </ActionForm>
              ) : (
                <div className="space-y-4">
                  <TextBlock label={ctx.t("incidents.managerResponse")} text={inc.manager_response} empty="—" />
                  <TextBlock label={ctx.t("incidents.investigation")} text={inc.investigation} empty="—" />
                  <TextBlock label={ctx.t("incidents.correctiveAction")} text={inc.corrective_action} empty="—" />
                </div>
              )}
            </CardBody>
          </Card>

          {ctx.can("view_audit_log") && (
            <Card>
              <CardHeader title={ctx.t("common.activity")} icon={<History className="h-4 w-4" />} />
              <CardBody><Activity ctx={ctx} entity="incidents" entityId={id} /></CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function TextBlock({ label, text, empty }: { label: string; text: string | null | undefined; empty?: string }) {
  if (!text && empty === undefined) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">{label}</div>
      <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{text || empty}</p>
    </div>
  );
}
