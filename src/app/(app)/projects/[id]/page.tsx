import type { Metadata } from "next";
import { Archive, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { Comments } from "@/components/shared/comments";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { DocumentTable, ExpenseTable, FuelTable, RepairTable, TaskTable, WorkLogTable, netHours, type WorkLogRow } from "@/components/shared/lists";
import { LiveMap } from "@/components/map";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList, Stat } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { addDays, fmtDate, fmtHours, fmtMoney, fmtNumber, todayIn } from "@/lib/format";
import { getMapData } from "@/lib/map-data";
import { getOptions } from "@/lib/queries";
import { statusTone } from "@/lib/utils";
import { archiveProject, unassignMachine, unassignWorker } from "../actions";
import { AddWorkSiteDialog, AssignMachineDialog, AssignTeamDialog, AssignWorkerDialog, EditProjectDialog } from "../components";

export const metadata: Metadata = { title: "Darba objekts" };

const TABS = ["overview", "workers", "machines", "hours", "production", "fuel", "expenses", "repairs", "tasks", "documents", "comments", "activity"] as const;

export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "overview";

  const { data: p } = await ctx.supabase.from("projects").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!p) notFound();
  const country = ctx.countries.find((c) => c.id === p.country_id);
  const tz = p.timezone ?? country?.timezone ?? ctx.timezone;
  const canManage = ctx.can("manage_projects");
  const path = `/projects/${id}`;
  const today = todayIn(ctx.timezone);
  const from = p.start_date ?? addDays(today, -90);

  const [summaryRes, workersRes, machinesRes, teamsRes, sitesRes] = await Promise.all([
    ctx.supabase.rpc("analytics_project_summary", { p_org: ctx.org.id, p_from: from < addDays(today, -365) ? addDays(today, -365) : from, p_to: today }),
    ctx.supabase.from("project_workers").select("id, project_role, assigned_at, employee:employees(id, full_name, job_title, status)").eq("project_id", id).is("unassigned_at", null),
    ctx.supabase.from("project_machines").select("id, assigned_at, machine:machines(id, name, category, status, engine_hours)").eq("project_id", id).is("unassigned_at", null),
    ctx.supabase.from("project_teams").select("team:teams(id, name)").eq("project_id", id),
    ctx.supabase.from("work_sites").select("id, name, site_identifiers, latitude, longitude, area_ha").eq("project_id", id).is("archived_at", null),
  ]);
  const s = (summaryRes.data ?? []).find((x) => x.project_id === id);
  const counts = { workers: workersRes.data?.length ?? 0, machines: machinesRes.data?.length ?? 0 };

  return (
    <>
      <PageHeader
        back={{ href: "/projects", label: ctx.t("projects.title") }}
        eyebrow={<><span>{country?.flag}</span><span>{country?.name}</span>{p.is_demo && <DemoBadge />}</>}
        title={p.code}
        subtitle={<>{p.name}{p.client_name ? ` · ${p.client_name}` : ""}</>}
        actions={<>
          <Badge tone={statusTone(p.status)} dot pulse={p.status === "active"} className="px-3 py-1 text-xs">{ctx.label("projects.status", p.status)}</Badge>
          {canManage && <EditProjectDialog countries={ctx.countries} values={{ ...p, site_identifiers: (p.site_identifiers ?? {}) as Record<string, string> }} />}
          {canManage && ctx.can("view_all_projects") && (
            <ActionButton action={archiveProject.bind(null, id)} variant="ghost" confirm={`${ctx.t("common.archive")}?`}><Archive className="h-4 w-4" /> {ctx.t("common.archive")}</ActionButton>
          )}
        </>}
      />
      <TabNav active={tab} items={TABS.map((k) => ({ key: k, label: ctx.t(`projects.tabs.${k}`), href: `${path}?tab=${k}`, count: k === "workers" ? counts.workers : k === "machines" ? counts.machines : null }))} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Card className="p-4"><Stat label={ctx.t("hours.total")} value={fmtHours(s?.hours)} /></Card>
            <Card className="p-4"><Stat label={ctx.t("projects.workers")} value={s?.workers ?? 0} hint={`${counts.workers} piešķirti`} /></Card>
            <Card className="p-4"><Stat label={ctx.t("fuel.litres")} value={s?.fuel_litres != null ? `${fmtNumber(s.fuel_litres)} L` : ctx.t("common.noData")} hint={s?.fuel_cost != null ? fmtMoney(s.fuel_cost, "EUR") : undefined} /></Card>
            <Card className="p-4"><Stat label={ctx.t("nav.production")} value={s?.production ? Object.entries(s.production as Record<string, number>).map(([u, q]) => `${fmtNumber(q)} ${ctx.label("production.units", u)}`).join(" · ") : ctx.t("common.noData")} /></Card>
            <Card className="p-4"><Stat label={ctx.t("nav.expenses")} value={s?.expenses != null ? fmtMoney(s.expenses, "EUR") : ctx.t("common.noData")} hint={`${s?.repairs ?? 0} remonti`} /></Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader title={ctx.t("projects.tabs.overview")} />
              <CardBody>
                <DefinitionList items={[
                  { label: ctx.t("projects.code"), value: p.code },
                  { label: ctx.t("projects.client"), value: p.client_name },
                  { label: ctx.t("common.country"), value: `${country?.flag ?? ""} ${country?.name ?? ""}` },
                  { label: ctx.t("projects.locationName"), value: p.location_name },
                  { label: ctx.t("common.address"), value: p.address },
                  { label: ctx.t("common.coordinates"), value: p.latitude != null ? `${p.latitude.toFixed(5)}, ${p.longitude?.toFixed(5)}` : null },
                  { label: ctx.t("projects.area"), value: p.area_ha != null ? `${fmtNumber(p.area_ha, 2)} ha` : null },
                  { label: ctx.t("projects.startDate"), value: fmtDate(p.start_date) },
                  { label: ctx.t("projects.expectedEnd"), value: fmtDate(p.expected_end_date) },
                  { label: ctx.t("projects.actualEnd"), value: fmtDate(p.actual_end_date) },
                  ...Object.entries((p.site_identifiers ?? {}) as Record<string, string>).map(([k, v]) => ({ label: ctx.label("projects.identifierFields", k), value: v })),
                ]} />
                {p.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{p.notes}</p>}
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title={ctx.t("map.title")} icon={<MapPin className="h-4 w-4" />} />
              <div className="px-3 pb-3">
                {p.latitude != null ? <ProjectMap ctx={ctx} projectId={id} /> : <EmptyState title={ctx.t("common.noData")} text={`${ctx.t("common.coordinates")}: —`} />}
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader title={ctx.t("projects.workSites")} action={canManage && <AddWorkSiteDialog projectId={id} identifierFields={country?.site_identifier_fields ?? []} />} />
            <CardBody>
              {(sitesRes.data ?? []).length ? (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(sitesRes.data ?? []).map((w) => (
                    <li key={w.id} className="rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 text-sm">
                      <div className="font-medium">{w.name}</div>
                      <div className="mt-1 text-xs text-muted">
                        {Object.entries((w.site_identifiers ?? {}) as Record<string, string>).map(([k, v]) => `${ctx.label("projects.identifierFields", k)}: ${v}`).join(" · ") || "—"}
                        {w.area_ha != null && ` · ${fmtNumber(w.area_ha, 1)} ha`}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "workers" && <WorkersTab ctx={ctx} projectId={id} workers={workersRes.data ?? []} teams={(teamsRes.data ?? []).map((t) => t.team as { id: string; name: string } | null).filter(Boolean) as { id: string; name: string }[]} canManage={canManage} />}
      {tab === "machines" && <MachinesTab ctx={ctx} projectId={id} links={machinesRes.data ?? []} canManage={canManage} />}
      {tab === "hours" && <HoursTab ctx={ctx} projectId={id} tz={tz} />}
      {tab === "production" && <ProductionTab ctx={ctx} projectId={id} />}
      {tab === "fuel" && <FuelTab ctx={ctx} projectId={id} tz={tz} />}
      {tab === "expenses" && <ExpensesTab ctx={ctx} projectId={id} />}
      {tab === "repairs" && <RepairsTab ctx={ctx} projectId={id} />}
      {tab === "tasks" && <TasksTab ctx={ctx} projectId={id} />}
      {tab === "documents" && <DocsTab ctx={ctx} projectId={id} />}
      {tab === "comments" && <Card><CardBody className="pt-5"><Comments ctx={ctx} entityType="project" entityId={id} path={`${path}?tab=comments`} /></CardBody></Card>}
      {tab === "activity" && <Card><CardBody className="pt-5"><Activity ctx={ctx} entity="projects" entityId={id} /></CardBody></Card>}
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof requireOrg>>;

async function ProjectMap({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const data = await getMapData(ctx, { projectId, countryId: null });
  return <LiveMap markers={data.markers} height={340} controls={false} />;
}

async function WorkersTab({ ctx, projectId, workers, teams, canManage }: { ctx: Ctx; projectId: string; workers: { id: string; project_role: string; assigned_at: string; employee: unknown }[]; teams: { id: string; name: string }[]; canManage: boolean }) {
  const opts = canManage ? await getOptions(ctx) : null;
  const assigned = new Set(workers.map((w) => (w.employee as { id: string } | null)?.id));
  return (
    <Card>
      <CardHeader title={ctx.t("projects.workers")} subtitle={teams.length ? `${ctx.t("nav.teams")}: ${teams.map((t) => t.name).join(", ")}` : undefined}
        action={canManage && opts && <div className="flex gap-2"><AssignTeamDialog projectId={projectId} teams={opts.teamOptions} /><AssignWorkerDialog projectId={projectId} employees={opts.employeeOptions.filter((e) => !assigned.has(e.value))} /></div>} />
      <CardBody>
        {workers.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {workers.map((w) => {
              const e = w.employee as { id: string; full_name: string; job_title: string | null; status: string } | null;
              return (
                <li key={w.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                  <Avatar name={e?.full_name} size={34} />
                  <Link href={`/employees/${e?.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium hover:text-amber">{e?.full_name}</span>
                    <span className="block truncate text-xs text-muted">{ctx.label("projects.projectRole", w.project_role)} · {e?.job_title}</span>
                  </Link>
                  {canManage && <ActionButton action={unassignWorker.bind(null, w.id, projectId)} variant="ghost" size="xs" confirm={`${ctx.t("common.unassign")}?`}>{ctx.t("common.unassign")}</ActionButton>}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={ctx.t("common.noData")} />}
      </CardBody>
    </Card>
  );
}

async function MachinesTab({ ctx, projectId, links, canManage }: { ctx: Ctx; projectId: string; links: { id: string; machine: unknown }[]; canManage: boolean }) {
  const opts = canManage ? await getOptions(ctx) : null;
  const assigned = new Set(links.map((l) => (l.machine as { id: string } | null)?.id));
  return (
    <Card>
      <CardHeader title={ctx.t("projects.machines")} action={canManage && opts && <AssignMachineDialog projectId={projectId} machines={opts.machineOptions.filter((m) => !assigned.has(m.value))} />} />
      <CardBody>
        {links.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((l) => {
              const m = l.machine as { id: string; name: string; category: string; status: string; engine_hours: number | null } | null;
              return (
                <li key={l.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                  <Link href={`/machines/${m?.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium hover:text-amber">{m?.name}</span>
                    <span className="block text-xs text-muted">{ctx.label("machines.categories", m?.category)} · {m?.engine_hours != null ? `${fmtNumber(m.engine_hours)} h` : "—"}</span>
                  </Link>
                  <Badge tone={statusTone(m?.status)}>{ctx.label("machines.status", m?.status)}</Badge>
                  {canManage && <ActionButton action={unassignMachine.bind(null, l.id, projectId)} variant="ghost" size="xs" confirm={`${ctx.t("common.unassign")}?`}>{ctx.t("common.unassign")}</ActionButton>}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title={ctx.t("common.noData")} />}
      </CardBody>
    </Card>
  );
}

async function HoursTab({ ctx, projectId, tz }: { ctx: Ctx; projectId: string; tz: string }) {
  const { data } = await ctx.supabase.from("work_logs")
    .select("id, started_at, ended_at, status, work_type, source, employee:employees(id, full_name), project:projects(id, code), machine:machines(id, name), breaks:work_breaks(started_at, ended_at)")
    .eq("project_id", projectId).is("deleted_at", null).order("started_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as WorkLogRow[];
  const total = rows.reduce((a, r) => a + netHours(r), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{ctx.t("hours.total")}: <span className="font-semibold text-ink">{fmtHours(total)}</span> ({rows.length} ieraksti, pēdējie 200)</p>
      <WorkLogTable rows={rows} tr={ctx} tz={tz} />
    </div>
  );
}

async function ProductionTab({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const { data } = await ctx.supabase.from("production_logs").select("id, production_date, quantity, unit, unit_label, work_type, employee:employees(full_name), machine:machines(name)")
    .eq("project_id", projectId).is("deleted_at", null).order("production_date", { ascending: false }).limit(200);
  const totals: Record<string, number> = {};
  for (const r of data ?? []) totals[r.unit] = (totals[r.unit] ?? 0) + Number(r.quantity);
  return (
    <Card>
      <CardHeader title={ctx.t("production.title")} subtitle={Object.entries(totals).map(([u, q]) => `${fmtNumber(q, 1)} ${ctx.label("production.units", u)}`).join(" · ") || ctx.t("common.noData")}
        action={<Link href={`/production?project=${projectId}&new=1`} className="text-sm text-amber hover:underline">+ {ctx.t("production.new")}</Link>} />
      <CardBody>
        <ul className="divide-y divide-line/70 text-sm">
          {(data ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="w-24 text-muted">{fmtDate(r.production_date)}</span>
              <span className="flex-1 truncate">{(r.employee as { full_name: string } | null)?.full_name ?? "—"} · {(r.machine as { name: string } | null)?.name ?? "—"}</span>
              <span className="font-medium tabular">{fmtNumber(r.quantity, 1)} {r.unit === "other" ? r.unit_label : ctx.label("production.units", r.unit)}</span>
            </li>
          ))}
          {!(data ?? []).length && <li className="py-6 text-center text-muted">{ctx.t("production.empty")}</li>}
        </ul>
      </CardBody>
    </Card>
  );
}

async function FuelTab({ ctx, projectId, tz }: { ctx: Ctx; projectId: string; tz: string }) {
  const { data } = await ctx.supabase.from("fuel_logs").select("id, occurred_at, litres, total_amount, currency, engine_hours, fuel_type, location_text, employee:employees(id, full_name), machine:machines(id, name), project:projects(id, code)")
    .eq("project_id", projectId).is("deleted_at", null).order("occurred_at", { ascending: false }).limit(200);
  return <FuelTable rows={(data ?? []) as never} tr={ctx} tz={tz} />;
}

async function ExpensesTab({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const { data } = await ctx.supabase.from("expenses").select("id, expense_date, amount, currency, category, status, description, employee:employees(id, full_name), project:projects(id, code)")
    .eq("project_id", projectId).is("deleted_at", null).order("expense_date", { ascending: false }).limit(200);
  return <ExpenseTable rows={(data ?? []) as never} tr={ctx} />;
}

async function RepairsTab({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const { data } = await ctx.supabase.from("repair_requests").select("id, title, priority, status, created_at, category, machine:machines(id, name), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(full_name)")
    .eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false });
  return <RepairTable rows={(data ?? []) as never} tr={ctx} tz={ctx.timezone} />;
}

async function TasksTab({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const { data } = await ctx.supabase.from("tasks").select("id, title, status, priority, deadline, assignee:employees(full_name), project:projects(code)")
    .eq("project_id", projectId).is("deleted_at", null).order("status").order("deadline");
  return <TaskTable rows={(data ?? []) as never} tr={ctx} tz={ctx.timezone} />;
}

async function DocsTab({ ctx, projectId }: { ctx: Ctx; projectId: string }) {
  const [docs, files] = await Promise.all([
    ctx.supabase.from("documents").select("id, name, document_type, expiry_date, version, status, entity_type, uploaded_at, file_id").eq("entity_type", "project").eq("entity_id", projectId).order("uploaded_at", { ascending: false }),
    loadFiles(ctx, "project", projectId),
  ]);
  return (
    <div className="space-y-6">
      <DocumentTable rows={(docs.data ?? []) as never} tr={ctx} />
      <Card>
        <CardHeader title={ctx.t("common.photos")} action={<div className="w-44"><FileUploader orgId={ctx.org.id} entityType="project" entityId={projectId} compact accept="image/*,video/*,application/pdf" /></div>} />
        <CardBody><FileGallery files={files} tz={ctx.timezone} empty={ctx.t("common.noData")} /></CardBody>
      </Card>
    </div>
  );
}
