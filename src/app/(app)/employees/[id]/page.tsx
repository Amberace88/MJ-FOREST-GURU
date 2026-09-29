import type { Metadata } from "next";
import { formatPhone, waLink } from "@/lib/phone";
import { Archive, ArchiveRestore, CheckCircle2, Circle, Clock, FileText, GraduationCap, KeyRound, Mail, Phone, Plus, ShieldCheck, TriangleAlert, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { DocumentTable, ExpenseTable, FuelTable, RepairTable, TaskTable, WorkLogTable, expiryBucket, netHours, type DocRow, type ExpenseRow, type FuelRow, type RepairRow, type TaskRow, type WorkLogRow } from "@/components/shared/lists";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DefinitionList, Stat } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requirePermission, type OrgContext } from "@/lib/context";
import { hasServiceRole } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { addDays, fmtDate, fmtDateTime, fmtHours, fmtMoney, todayIn, zonedMidnightUtc } from "@/lib/format";
import { grantableRoles } from "@/lib/invite";
import { getOptions } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusTone } from "@/lib/utils";
import { archiveEmployee, restoreEmployee } from "../actions";
import { CompensationDialog, EditEmployeeDialog, InviteDialog, PhotoUploader } from "../components";
import { liveInfo, photoUrls } from "../data";

export const metadata: Metadata = { title: "Darbinieks" };

const TABS = ["overview", "hours", "projects", "machines", "fuel", "expenses", "tasks", "repairs", "documents", "training", "safety", "activity"] as const;
type Tab = (typeof TABS)[number];

export default async function EmployeeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePermission("view_all_employees", "view_team", "edit_employees");
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";

  const { data: e } = await ctx.supabase.from("employees")
    .select("*, team:teams!employees_team_fk(id, name)")
    .eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!e) notFound();

  const country = ctx.countries.find((c) => c.id === e.country_id);
  const team = e.team as { id: string; name: string } | null;
  const canEdit = ctx.can("edit_employees");
  const path = `/employees/${id}`;
  const [live, photos] = await Promise.all([liveInfo(ctx, [id]), photoUrls(ctx, [e.photo_path])]);
  const info = live.get(id);
  const photo = e.photo_path ? photos.get(e.photo_path) ?? null : null;
  const opts = canEdit ? await getOptions(ctx) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/employees", label: ctx.t("employees.title") }}
        eyebrow={<>{country && <span>{country.flag} {country.name}</span>}{team && <span>· {team.name}</span>}{e.is_demo && <DemoBadge />}</>}
        title={
          <span className="flex items-center gap-4">
            <span className="relative">
              <Avatar name={e.full_name} src={photo} size={56} />
              {info?.working && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-bg bg-ok" />}
            </span>
            <span className="min-w-0">{e.full_name}</span>
          </span>
        }
        subtitle={<>{e.job_title ?? "—"}{info?.project ? <> · <Link href={`/projects/${info.project.id}`} className="text-ink-2 hover:text-amber">{info.project.code}</Link></> : null}{info?.machine ? ` · ${info.machine.name}` : ""}</>}
        actions={<>
          {e.archived_at ? <Badge tone="off" className="px-3 py-1 text-xs">{ctx.t("employees.archived")}</Badge>
            : <Badge tone={statusTone(e.status)} dot pulse={info?.working} className="px-3 py-1 text-xs">{ctx.label("employees.status", e.status)}</Badge>}
          {canEdit && opts && <EditEmployeeDialog countries={opts.countryOptions} teams={opts.teamOptions} values={{ ...e, id }} />}
          {canEdit && !e.archived_at && (
            <ActionButton action={archiveEmployee.bind(null, id)} variant="ghost" confirm={ctx.t("employees.archiveConfirm")}><Archive className="h-4 w-4" /> {ctx.t("common.archive")}</ActionButton>
          )}
          {canEdit && e.archived_at && (
            <ActionButton action={restoreEmployee.bind(null, id)} variant="secondary"><ArchiveRestore className="h-4 w-4" /> {ctx.t("common.restore")}</ActionButton>
          )}
        </>}
      />
      <TabNav active={tab} items={TABS.map((k) => ({ key: k, label: ctx.t(`employees.tabs.${k}`), href: `${path}?tab=${k}` }))} />

      {tab === "overview" && <OverviewTab ctx={ctx} emp={e} team={team} info={info} canEdit={canEdit} />}
      {tab === "hours" && <HoursTab ctx={ctx} employeeId={id} tz={country?.timezone ?? ctx.timezone} />}
      {tab === "projects" && <ProjectsTab ctx={ctx} employeeId={id} />}
      {tab === "machines" && <MachinesTab ctx={ctx} employeeId={id} />}
      {tab === "fuel" && <FuelTab ctx={ctx} employeeId={id} />}
      {tab === "expenses" && <ExpensesTab ctx={ctx} employeeId={id} />}
      {tab === "tasks" && <TasksTab ctx={ctx} employeeId={id} />}
      {tab === "repairs" && <RepairsTab ctx={ctx} employeeId={id} />}
      {tab === "documents" && <DocsTab ctx={ctx} employeeId={id} />}
      {tab === "training" && <TrainingTab ctx={ctx} employeeId={id} />}
      {tab === "safety" && <SafetyTab ctx={ctx} employeeId={id} countryId={e.country_id} />}
      {tab === "activity" && <Card><CardBody className="pt-5"><Activity ctx={ctx} entity="employees" entityId={id} /></CardBody></Card>}
    </>
  );
}

type Emp = {
  id: string; organization_id: string; user_id: string | null; first_name: string; last_name: string; full_name: string | null; email: string | null; phone: string | null; whatsapp?: string | null;
  job_title: string | null; status: string; employment_start: string | null; employment_end: string | null; notes: string | null; country_id: string | null; archived_at: string | null;
};
type Live = Awaited<ReturnType<typeof liveInfo>> extends Map<string, infer V> ? V : never;

/* ------------------------------------------------------------------ overview */
async function OverviewTab({ ctx, emp, team, info, canEdit }: { ctx: OrgContext; emp: Emp; team: { id: string; name: string } | null; info: Live | undefined; canEdit: boolean }) {
  const today = todayIn(ctx.timezone);
  const since = zonedMidnightUtc(addDays(today, -29), ctx.timezone).toISOString();
  const canSalary = ctx.can("view_salaries");
  const [logsRes, compRes, trainingRes] = await Promise.all([
    ctx.supabase.from("work_logs").select("id, started_at, ended_at, status, work_type, source, breaks:work_breaks(started_at, ended_at)")
      .eq("organization_id", ctx.org.id).eq("employee_id", emp.id).is("deleted_at", null).gte("started_at", since).limit(500),
    canSalary ? ctx.supabase.from("employee_compensation").select("hourly_rate, monthly_salary, currency").eq("employee_id", emp.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("employee_training").select("id, expires_at").eq("employee_id", emp.id).not("expires_at", "is", null),
  ]);
  const hours30 = ((logsRes.data ?? []) as unknown as WorkLogRow[]).reduce((a, l) => a + netHours(l), 0);
  const days30 = new Set((logsRes.data ?? []).map((l) => l.started_at.slice(0, 10))).size;
  const comp = compRes.data as { hourly_rate: number | null; monthly_salary: number | null; currency: string } | null;
  const expiringTraining = (trainingRes.data ?? []).filter((t) => ["expired", "d7", "d14", "d30"].includes(expiryBucket(t.expires_at).key)).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={ctx.t("employees.todayHours")} value={info && info.todayHours > 0 ? fmtHours(info.todayHours) : "—"} hint={info?.working ? ctx.t("employees.working") : ctx.t("employees.notWorking")} /></Card>
        <Card className="p-4"><Stat label={ctx.t("employees.hoursLast30")} value={fmtHours(hours30)} hint={`${ctx.t("hours.daysWorked")}: ${days30}`} /></Card>
        <Card className="p-4"><Stat label={ctx.t("employees.currentProject")} value={info?.project ? <Link href={`/projects/${info.project.id}`} className="hover:text-amber">{info.project.code}</Link> : "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("employees.currentMachine")} value={info?.machine ? <Link href={`/machines/${info.machine.id}`} className="hover:text-amber">{info.machine.name}</Link> : "—"} /></Card>
      </div>
      {expiringTraining > 0 && (
        <Link href={`/employees/${emp.id}?tab=training`} className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn hover:bg-warn/15">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {ctx.t("employees.trainingExpiring", { n: expiringTraining })}
        </Link>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("employees.contact")} />
            <CardBody>
              <DefinitionList items={[
                { label: ctx.t("employees.email"), value: emp.email ? <a href={`mailto:${emp.email}`} className="inline-flex items-center gap-1.5 hover:text-amber"><Mail className="h-3.5 w-3.5" />{emp.email}</a> : null },
                { label: ctx.t("employees.phone"), value: emp.phone ? <a href={`tel:${emp.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-amber"><Phone className="h-3.5 w-3.5" />{formatPhone(emp.phone)}</a> : null },
                { label: "WhatsApp", value: emp.whatsapp ? <a href={waLink(emp.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-ok hover:text-amber"><MessageCircle className="h-3.5 w-3.5" />{formatPhone(emp.whatsapp)}</a> : null },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={ctx.t("employees.employment")} />
            <CardBody>
              <DefinitionList items={[
                { label: ctx.t("employees.jobTitle"), value: emp.job_title },
                { label: ctx.t("common.status"), value: ctx.label("employees.status", emp.status) },
                { label: ctx.t("common.country"), value: (() => { const c = ctx.countries.find((x) => x.id === emp.country_id); return c ? `${c.flag ?? ""} ${c.name}` : null; })() },
                { label: ctx.t("common.team"), value: team ? <Link href={`/teams/${team.id}`} className="hover:text-amber">{team.name}</Link> : ctx.t("employees.noTeam") },
                { label: ctx.t("employees.employmentStart"), value: fmtDate(emp.employment_start) },
                { label: ctx.t("employees.employmentEnd"), value: fmtDate(emp.employment_end) },
              ]} />
              {emp.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{emp.notes}</p>}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader title={ctx.t("common.photo")} />
              <CardBody><PhotoUploader orgId={ctx.org.id} employeeId={emp.id} /></CardBody>
            </Card>
          )}
          {canSalary && (
            <Card>
              <CardHeader title={ctx.t("employees.compensation")} action={canEdit && <CompensationDialog employeeId={emp.id} values={comp} />} />
              <CardBody>
                <DefinitionList items={[
                  { label: ctx.t("employees.hourlyRate"), value: comp?.hourly_rate != null ? fmtMoney(comp.hourly_rate, comp.currency) : null },
                  { label: ctx.t("employees.monthlySalary"), value: comp?.monthly_salary != null ? fmtMoney(comp.monthly_salary, comp.currency) : null },
                ]} />
              </CardBody>
            </Card>
          )}
          <AccountCard ctx={ctx} emp={emp} />
        </div>
      </div>
    </div>
  );
}

async function AccountCard({ ctx, emp }: { ctx: OrgContext; emp: Emp }) {
  const canInvite = ctx.can("manage_users");
  let state: "hasAccount" | "noAccount" | "invited" = emp.user_id ? "hasAccount" : "noAccount";
  let invite: { expires_at: string; created_at: string; role_key: string } | null = null;
  if (canInvite) {
    const { data } = await ctx.supabase.from("invitations").select("expires_at, created_at, role_key, accepted_at, revoked_at")
      .eq("organization_id", ctx.org.id).eq("employee_id", emp.id).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data && !data.accepted_at) invite = data;
    // An invited auth user exists immediately; they count as "invited" until the first sign-in.
    if (emp.user_id && invite && hasServiceRole()) {
      try {
        const { data: u } = await createAdminClient().auth.admin.getUserById(emp.user_id);
        if (u.user && !u.user.last_sign_in_at) state = "invited";
      } catch (err) {
        logServerError("employee.account_status", err);
      }
    }
  }
  const roles = grantableRoles(ctx).map((r) => ({ value: r, label: ctx.label("users.roleNames", r) }));
  const disabledReason = !hasServiceRole() ? ctx.t("users.serviceKeyMissing") : null;
  const tone = state === "hasAccount" ? "ok" : state === "invited" ? "warn" : "off";

  return (
    <Card>
      <CardHeader title={ctx.t("employees.account")} icon={<KeyRound className="h-4 w-4" />}
        action={<Badge tone={tone} dot>{state === "invited" ? ctx.t("employees.invited") : ctx.t(`employees.${state}`)}</Badge>} />
      <CardBody className="space-y-3">
        {invite && state !== "hasAccount" && (
          <p className="text-xs text-muted">
            {ctx.label("users.roleNames", invite.role_key)} · {fmtDateTime(invite.created_at, ctx.timezone)} · {ctx.t("employees.inviteExpires", { date: fmtDate(invite.expires_at, ctx.timezone) })}
          </p>
        )}
        {canInvite && !emp.user_id && !emp.archived_at && (
          <InviteDialog employeeId={emp.id} email={emp.email} roles={roles} disabledReason={disabledReason} />
        )}
        {emp.user_id && canInvite && (
          <Link href="/settings/users" className="text-xs text-amber hover:underline">{ctx.t("nav.users")} →</Link>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ tabs */
async function HoursTab({ ctx, employeeId, tz }: { ctx: OrgContext; employeeId: string; tz: string }) {
  const { data } = await ctx.supabase.from("work_logs")
    .select("id, started_at, ended_at, status, work_type, source, project:projects(id, code), machine:machines(id, name), breaks:work_breaks(started_at, ended_at)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).is("deleted_at", null).order("started_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as WorkLogRow[];
  const total = rows.reduce((a, r) => a + netHours(r), 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{ctx.t("hours.total")}: <span className="font-semibold text-ink tabular">{fmtHours(total)}</span> · {ctx.t("employees.hoursRecent", { n: rows.length })}</p>
        <Link href={`/hours?employee=${employeeId}`} className="inline-flex items-center gap-1 text-sm text-amber hover:underline"><Clock className="h-4 w-4" /> {ctx.t("nav.hours")}</Link>
      </div>
      <WorkLogTable rows={rows} tr={ctx} tz={tz} showEmployee={false} />
    </div>
  );
}

async function ProjectsTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("project_workers")
    .select("id, project_role, assigned_at, unassigned_at, project:projects(id, code, name, status)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).order("assigned_at", { ascending: false }).limit(200);
  type Row = { id: string; project_role: string; assigned_at: string; unassigned_at: string | null; project: { id: string; code: string; name: string; status: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => (r.project ? `/projects/${r.project.id}` : "#")}
      empty={<EmptyState title={ctx.t("common.noData")} />}
      columns={[
        { key: "p", header: ctx.t("common.project"), cell: (r) => r.project ? `${r.project.code} · ${r.project.name}` : "—" },
        { key: "r", header: ctx.t("common.type"), cell: (r) => ctx.label("projects.projectRole", r.project_role) },
        { key: "from", header: ctx.t("common.from"), cell: (r) => fmtDate(r.assigned_at, ctx.timezone) },
        { key: "to", header: ctx.t("common.to"), cell: (r) => r.unassigned_at ? fmtDate(r.unassigned_at, ctx.timezone) : <Badge tone="ok" dot>{ctx.t("employees.current")}</Badge> },
        { key: "s", header: ctx.t("common.status"), cell: (r) => r.project ? <Badge tone={statusTone(r.project.status)}>{ctx.label("projects.status", r.project.status)}</Badge> : "—", hideOnMobile: true },
      ]} />
  );
}

async function MachinesTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("machine_assignments")
    .select("id, started_at, ended_at, source, machine:machines(id, name, category), project:projects(id, code)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).order("started_at", { ascending: false }).limit(200);
  type Row = { id: string; started_at: string; ended_at: string | null; source: string; machine: { id: string; name: string; category: string } | null; project: { id: string; code: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => (r.machine ? `/machines/${r.machine.id}` : "#")}
      empty={<EmptyState title={ctx.t("common.noData")} />}
      columns={[
        { key: "m", header: ctx.t("common.machine"), cell: (r) => r.machine?.name ?? "—" },
        { key: "c", header: ctx.t("common.category"), cell: (r) => ctx.label("machines.categories", r.machine?.category), hideOnMobile: true },
        { key: "p", header: ctx.t("common.project"), cell: (r) => r.project?.code ?? "—" },
        { key: "from", header: ctx.t("common.from"), cell: (r) => fmtDateTime(r.started_at, ctx.timezone) },
        { key: "to", header: ctx.t("common.to"), cell: (r) => r.ended_at ? fmtDateTime(r.ended_at, ctx.timezone) : <Badge tone="ok" dot pulse>{ctx.t("employees.current")}</Badge> },
        { key: "h", header: ctx.t("common.hours"), cell: (r) => fmtHours(((r.ended_at ? new Date(r.ended_at).getTime() : Date.now()) - new Date(r.started_at).getTime()) / 3_600_000), align: "right", hideOnMobile: true },
      ]} />
  );
}

async function FuelTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("fuel_logs").select("id, occurred_at, litres, total_amount, currency, engine_hours, fuel_type, location_text, employee:employees(id, full_name), machine:machines(id, name), project:projects(id, code)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).is("deleted_at", null).order("occurred_at", { ascending: false }).limit(200);
  return <FuelTable rows={(data ?? []) as unknown as FuelRow[]} tr={ctx} tz={ctx.timezone} />;
}

async function ExpensesTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("expenses").select("id, expense_date, amount, currency, category, status, description, employee:employees(id, full_name), project:projects(id, code)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).is("deleted_at", null).order("expense_date", { ascending: false }).limit(200);
  return <ExpenseTable rows={(data ?? []) as unknown as ExpenseRow[]} tr={ctx} />;
}

async function TasksTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("tasks").select("id, title, status, priority, deadline, assignee:employees(full_name), project:projects(code)")
    .eq("organization_id", ctx.org.id).eq("assignee_employee_id", employeeId).is("deleted_at", null).order("status").order("deadline").limit(200);
  return <TaskTable rows={(data ?? []) as unknown as TaskRow[]} tr={ctx} tz={ctx.timezone} />;
}

async function RepairsTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("repair_requests")
    .select("id, title, priority, status, created_at, category, machine:machines(id, name), project:projects(code), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(full_name)")
    .eq("organization_id", ctx.org.id).eq("reported_by_employee_id", employeeId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{ctx.t("employees.reportedRepairs")}</p>
      <RepairTable rows={(data ?? []) as unknown as RepairRow[]} tr={ctx} tz={ctx.timezone} />
    </div>
  );
}

async function DocsTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("documents").select("id, name, document_type, expiry_date, version, status, entity_type, uploaded_at, file_id")
    .eq("organization_id", ctx.org.id).eq("entity_type", "employee").eq("entity_id", employeeId).eq("status", "active").order("uploaded_at", { ascending: false });
  const opts = await getOptions(ctx);
  const typeLabel = new Map(opts.documentTypes.map((d) => [d.value, d.label]));
  const rows = ((data ?? []) as DocRow[]).map((d) => ({ ...d, document_type: typeLabel.get(d.document_type) ?? d.document_type }));
  return (
    <div className="space-y-3">
      {ctx.can("manage_documents") && (
        <div className="flex justify-end">
          <ButtonLink href={`/documents?new=1&entity_type=employee&entity_id=${employeeId}`} size="sm" variant="secondary"><Plus className="h-4 w-4" /> {ctx.t("documents.new")}</ButtonLink>
        </div>
      )}
      <DocumentTable rows={rows} tr={ctx} />
    </div>
  );
}

async function TrainingTab({ ctx, employeeId }: { ctx: OrgContext; employeeId: string }) {
  const { data } = await ctx.supabase.from("employee_training")
    .select("id, title, completed_at, expires_at, certificate_number, certificate_file_id, training:safety_training(id, title, is_required)")
    .eq("organization_id", ctx.org.id).eq("employee_id", employeeId).order("expires_at", { ascending: true, nullsFirst: false });
  type Row = { id: string; title: string; completed_at: string | null; expires_at: string | null; certificate_number: string | null; certificate_file_id: string | null; training: { id: string; title: string; is_required: boolean } | null };
  const rows = (data ?? []) as unknown as Row[];
  const canAdd = ctx.canAny("manage_safety", "edit_employees");
  return (
    <div className="space-y-3">
      {canAdd && (
        <div className="flex justify-end">
          <ButtonLink href={`/training?new=1&employee=${employeeId}`} size="sm" variant="secondary"><Plus className="h-4 w-4" /> {ctx.t("training.new")}</ButtonLink>
        </div>
      )}
      <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState icon={<GraduationCap className="h-6 w-6" />} title={ctx.t("training.empty")} />}
        columns={[
          { key: "t", header: ctx.t("training.course"), cell: (r) => <span className="flex items-center gap-2">{r.title}{r.training?.is_required && <Badge tone="amber">{ctx.t("training.required")}</Badge>}</span> },
          { key: "c", header: ctx.t("training.completed"), cell: (r) => fmtDate(r.completed_at) },
          { key: "e", header: ctx.t("training.expires"), cell: (r) => {
            if (!r.expires_at) return <span className="text-muted">{ctx.t("training.noExpiry")}</span>;
            const b = expiryBucket(r.expires_at);
            return <span className="flex items-center justify-end gap-2 md:justify-start">{fmtDate(r.expires_at)} <Badge tone={b.tone}>{b.key === "ok" ? ctx.t("training.valid") : ctx.label("documents.expiring", b.key)}</Badge></span>;
          } },
          { key: "n", header: ctx.t("training.certificate"), cell: (r) => r.certificate_number ?? "—", hideOnMobile: true },
          { key: "f", header: ctx.t("common.file"), cell: (r) => r.certificate_file_id ? <Link href={`/training?cert=${r.certificate_file_id}`} className="inline-flex items-center gap-1 text-amber hover:underline"><FileText className="h-3.5 w-3.5" />{ctx.t("common.open")}</Link> : "—", hideOnMobile: true },
        ]} />
    </div>
  );
}

async function SafetyTab({ ctx, employeeId, countryId }: { ctx: OrgContext; employeeId: string; countryId: string | null }) {
  let rulesQuery = ctx.supabase.from("safety_rules").select("id, title, section, current_version, country_id")
    .eq("organization_id", ctx.org.id).eq("is_active", true).eq("requires_acknowledgement", true).order("section").order("sort_order");
  rulesQuery = countryId ? rulesQuery.or(`country_id.is.null,country_id.eq.${countryId}`) : rulesQuery.is("country_id", null);
  const [rulesRes, acksRes] = await Promise.all([
    rulesQuery,
    ctx.supabase.from("safety_acknowledgements").select("rule_id, version, acknowledged_at").eq("organization_id", ctx.org.id).eq("employee_id", employeeId),
  ]);
  const rules = rulesRes.data ?? [];
  const latestAck = new Map<string, { version: number; acknowledged_at: string }>();
  for (const a of acksRes.data ?? []) {
    const prev = latestAck.get(a.rule_id);
    if (!prev || a.version > prev.version) latestAck.set(a.rule_id, { version: a.version, acknowledged_at: a.acknowledged_at });
  }
  const done = rules.filter((r) => (latestAck.get(r.id)?.version ?? 0) >= r.current_version).length;
  if (!rules.length) return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={ctx.t("common.noData")} />;
  return (
    <Card>
      <CardHeader title={ctx.t("employees.safetyStatus")} icon={<ShieldCheck className="h-4 w-4" />} subtitle={ctx.t("employees.safetyCoverage", { done, total: rules.length })}
        action={<Badge tone={done === rules.length ? "ok" : "warn"}>{Math.round((done / rules.length) * 100)}%</Badge>} />
      <CardBody>
        <ul className="divide-y divide-line/70">
          {rules.map((r) => {
            const ack = latestAck.get(r.id);
            const ok = (ack?.version ?? 0) >= r.current_version;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" /> : <Circle className="h-4 w-4 shrink-0 text-warn" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{r.title} <span className="text-xs text-faint">v{r.current_version}</span></div>
                  <div className="text-xs text-muted">{ctx.label("safety.sections", r.section)}</div>
                </div>
                <div className="text-right text-xs">
                  {ok && ack ? <span className="text-ok">{ctx.t("safety.acknowledged")} · {fmtDate(ack.acknowledged_at, ctx.timezone)}</span>
                    : ack ? <span className="text-warn">{ctx.t("employees.safetyOutdated", { old: ack.version, current: r.current_version })}</span>
                    : <span className="text-warn">{ctx.t("safety.notAcknowledged")}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
