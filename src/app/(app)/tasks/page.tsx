import type { Metadata } from "next";
import { AlertTriangle, Archive, CalendarClock, ClipboardList, ListTodo, UserCheck } from "lucide-react";
import Link from "next/link";
import { Comments } from "@/components/shared/comments";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { DefinitionList } from "@/components/ui/card";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { ActionButton } from "@/components/ui/form";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireOrg, type OrgContext } from "@/lib/context";
import { addDays, fmtDateTime, todayIn, utcToLocalInput, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { cn, likeTerm, priorityTone, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { RoutedDialog } from "../receipts/routed-dialog";
import { archiveTask, setTaskStatus } from "./actions";
import { BOARD_COLUMNS, TaskBoard, type BoardStatus, type BoardTask } from "./board";
import { EditTaskDialog, NewTaskDialog, type TaskFormOptions } from "./components";

export const metadata: Metadata = { title: "Uzdevumi" };

type SP = Record<string, string | string[] | undefined>;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const DONE_WINDOW_DAYS = 30;

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const canManage = ctx.can("manage_tasks");
  const myEmp = ctx.employee?.id ?? null;
  const assignee = UUID_RE.test(one(sp.assignee) ?? "") ? one(sp.assignee)! : null;
  const project = UUID_RE.test(one(sp.project) ?? "") ? one(sp.project)! : null;
  const priority = (PRIORITIES as readonly string[]).includes(one(sp.priority) ?? "") ? one(sp.priority)! : null;
  const mine = one(sp.mine) === "1";
  const term = likeTerm(one(sp.q));
  const taskId = one(sp.task);
  const doneSince = zonedMidnightUtc(addDays(todayIn(ctx.timezone), -DONE_WINDOW_DAYS), ctx.timezone).toISOString();

  let q = ctx.supabase.from("tasks")
    .select("id, title, status, priority, deadline, position, assignee_employee_id, is_demo, assignee:employees(id, full_name), project:projects(id, code), machine:machines(id, name)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .in("status", [...BOARD_COLUMNS])
    .or(`status.neq.done,completed_at.gte.${doneSince}`)
    .limit(600);
  if (assignee) q = q.eq("assignee_employee_id", assignee);
  if (mine) q = myEmp ? q.eq("assignee_employee_id", myEmp) : q.eq("created_by", ctx.user.id);
  if (project) q = q.eq("project_id", project);
  if (priority) q = q.eq("priority", priority);
  if (term) q = q.ilike("title", term);

  const [{ data }, opts] = await Promise.all([q, getOptions(ctx)]);
  const now = Date.now();
  const rows = (data ?? []).map((r) => ({
    ...r,
    assignee: r.assignee as unknown as { id: string; full_name: string } | null,
    project: r.project as unknown as { id: string; code: string } | null,
    machine: r.machine as unknown as { id: string; name: string } | null,
  }));
  rows.sort((a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9)
    || (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity)
    || b.position - a.position);

  const tasks: BoardTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as BoardStatus,
    priority: r.priority,
    deadlineLabel: r.deadline ? fmtDateTime(r.deadline, ctx.timezone) : null,
    overdue: Boolean(r.deadline && r.status !== "done" && new Date(r.deadline).getTime() < now),
    assigneeName: r.assignee?.full_name ?? null,
    projectCode: r.project?.code ?? null,
    machineName: r.machine?.name ?? null,
    canMove: canManage || (myEmp !== null && r.assignee_employee_id === myEmp),
    mine: myEmp !== null && r.assignee_employee_id === myEmp,
  }));
  const open = tasks.filter((x) => x.status !== "done").length;
  const overdue = tasks.filter((x) => x.overdue).length;
  const mineOpen = tasks.filter((x) => x.mine && x.status !== "done").length;

  const formOptions: TaskFormOptions = { projects: opts.projectOptions, machines: opts.machineOptions, employees: opts.employeeOptions, teams: opts.teamOptions };
  const canCreate = canManage || Boolean(myEmp);
  const filters: FilterDef[] = [
    { type: "search", name: "q", placeholder: ctx.t("tasks.searchPlaceholder") },
    ...(myEmp ? [{ type: "select" as const, name: "mine", label: ctx.t("tasks.whose"), options: [{ value: "1", label: ctx.t("tasks.mine") }] }] : []),
    ...(canManage ? [{ type: "select" as const, name: "assignee", label: ctx.t("tasks.assignee"), options: opts.employeeOptions }] : []),
    { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
    { type: "select", name: "priority", label: ctx.t("common.priority"), options: PRIORITIES.map((p) => ({ value: p, label: ctx.label("tasks.priority", p) })) },
  ];
  const closeHref = `/tasks${searchParamsToString(sp, { task: null, new: null })}`;

  return (
    <>
      <PageHeader title={ctx.t("tasks.title")} subtitle={ctx.t("tasks.subtitle")}
        actions={canCreate && <NewTaskDialog options={formOptions} canManage={canManage} defaultOpen={one(sp.new) === "1"} defaultProjectId={project ?? undefined} />} />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-xl">
        <SummaryChip icon={<ListTodo className="h-4 w-4" />} label={ctx.t("tasks.openCount")} value={open} />
        <SummaryChip icon={<AlertTriangle className="h-4 w-4" />} label={ctx.t("tasks.overdue")} value={overdue} tone={overdue ? "crit" : undefined} />
        {myEmp ? (
          <Link href={`/tasks${searchParamsToString(sp, { mine: mine ? null : "1", task: null })}`} className="block">
            <SummaryChip icon={<UserCheck className="h-4 w-4" />} label={ctx.t("tasks.mine")} value={mineOpen} tone={mine ? "amber" : undefined} />
          </Link>
        ) : <SummaryChip icon={<CalendarClock className="h-4 w-4" />} label={ctx.label("tasks.status", "done")} value={tasks.length - open} />}
      </div>

      <FilterBar filters={filters} />

      {tasks.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={ctx.t("tasks.empty")} text={ctx.t("tasks.emptyHint")}
          action={canCreate ? <NewTaskDialog options={formOptions} canManage={canManage} /> : undefined} />
      ) : (
        <TaskBoard tasks={tasks} />
      )}
      <p className="mt-3 text-xs text-faint">{ctx.t("tasks.doneWindow", { n: DONE_WINDOW_DAYS })}</p>

      {taskId && <TaskDetail key={taskId} ctx={ctx} id={taskId} closeHref={closeHref} formOptions={formOptions} />}
    </>
  );
}

function SummaryChip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "crit" | "amber" }) {
  return (
    <div className={cn("card flex items-center gap-2.5 px-3 py-2.5", tone === "crit" && "border-crit/40", tone === "amber" && "border-amber/50")}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss", tone === "crit" && "text-crit", tone === "amber" && "text-amber")}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold leading-none tabular text-ink">{value}</span>
        <span className="block truncate text-[11px] uppercase tracking-wider text-muted">{label}</span>
      </span>
    </div>
  );
}

async function TaskDetail({ ctx, id, closeHref, formOptions }: { ctx: OrgContext; id: string; closeHref: string; formOptions: TaskFormOptions }) {
  if (!UUID_RE.test(id)) return null;
  const { data: task } = await ctx.supabase.from("tasks")
    .select("*, assignee:employees(id, full_name), project:projects(id, code, name), machine:machines(id, name), team:teams(id, name)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!task) {
    return <RoutedDialog title={ctx.t("quick.task")} closeHref={closeHref} size="md"><EmptyState title={ctx.t("errors.notFound")} /></RoutedDialog>;
  }
  const assignee = task.assignee as unknown as { id: string; full_name: string } | null;
  const project = task.project as unknown as { id: string; code: string; name: string } | null;
  const machine = task.machine as unknown as { id: string; name: string } | null;
  const team = task.team as unknown as { id: string; name: string } | null;
  const [files, creator] = await Promise.all([
    loadFiles(ctx, "task", id),
    task.created_by ? ctx.supabase.from("profiles").select("full_name").eq("id", task.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canManage = ctx.can("manage_tasks");
  const isAssignee = Boolean(ctx.employee && task.assignee_employee_id === ctx.employee.id);
  const canStatus = canManage || isAssignee;
  const overdue = Boolean(task.deadline && task.status !== "done" && task.status !== "cancelled" && new Date(task.deadline).getTime() < Date.now());
  const path = `/tasks?task=${id}`;
  const statuses = [...BOARD_COLUMNS, ...(canManage ? (["cancelled"] as const) : [])];

  return (
    <RoutedDialog size="lg" closeHref={closeHref} title={task.title}
      description={<span className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(task.status)} dot>{ctx.label("tasks.status", task.status)}</Badge>
        <Badge tone={priorityTone(task.priority)}>{ctx.label("tasks.priority", task.priority)}</Badge>
        {overdue && <Badge tone="crit" dot pulse>{ctx.t("tasks.overdue")}</Badge>}
        {task.is_demo && <DemoBadge />}
      </span>}
      headerExtra={canManage && (
        <EditTaskDialog options={{ ...formOptions, projects: project && !formOptions.projects.some((p) => p.value === project.id) ? [{ value: project.id, label: `${project.code} · ${project.name}` }, ...formOptions.projects] : formOptions.projects }}
          values={{
            id: task.id, title: task.title, description: task.description, project_id: task.project_id, machine_id: task.machine_id, team_id: task.team_id,
            assignee_employee_id: task.assignee_employee_id, priority: task.priority, deadlineLocal: utcToLocalInput(task.deadline, ctx.timezone),
          }} />
      )}>
      <div className="space-y-6">
        {canStatus && (
          <div>
            <SectionTitle>{ctx.t("tasks.changeStatus")}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <ActionButton key={s} action={setTaskStatus.bind(null, id)} fields={{ status: s }} size="md"
                  variant={task.status === s ? "primary" : s === "done" ? "outline" : "secondary"}
                  className={cn(task.status === s && "pointer-events-none")}>
                  {ctx.label("tasks.status", s)}
                </ActionButton>
              ))}
            </div>
          </div>
        )}

        {task.description && <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3.5 text-sm text-ink-2">{task.description}</p>}

        <DefinitionList items={[
          { label: ctx.t("tasks.assignee"), value: assignee?.full_name },
          { label: ctx.t("common.team"), value: team?.name },
          { label: ctx.t("common.project"), value: project ? <Link href={`/projects/${project.id}`} className="hover:text-amber">{project.code} · {project.name}</Link> : null },
          { label: ctx.t("common.machine"), value: machine ? <Link href={`/machines/${machine.id}`} className="hover:text-amber">{machine.name}</Link> : null },
          { label: ctx.t("common.deadline"), value: task.deadline ? <span className={cn(overdue && "font-medium text-crit")}>{fmtDateTime(task.deadline, ctx.timezone)}</span> : null },
          { label: ctx.t("common.createdBy"), value: `${creator.data?.full_name ?? "—"} · ${fmtDateTime(task.created_at, ctx.timezone)}` },
          ...(task.completed_at ? [{ label: ctx.t("tasks.completedAt"), value: fmtDateTime(task.completed_at, ctx.timezone) }] : []),
        ]} />

        <div>
          <SectionTitle action={<div className="w-44"><FileUploader orgId={ctx.org.id} entityType="task" entityId={id} compact accept="image/*,video/*,application/pdf" label={ctx.t("common.photo")} /></div>}>
            {ctx.t("common.photos")}
          </SectionTitle>
          <FileGallery files={files} tz={ctx.timezone} empty={ctx.t("common.noData")} />
        </div>

        <div>
          <SectionTitle>{ctx.t("common.comments")}</SectionTitle>
          <Comments ctx={ctx} entityType="task" entityId={id} path={path} />
        </div>

        {canManage && (
          <div className="flex justify-end border-t border-line pt-4">
            <ActionButton action={archiveTask.bind(null, id)} variant="ghost" confirm={`${ctx.t("common.archive")}?`}>
              <Archive className="h-4 w-4" /> {ctx.t("common.archive")}
            </ActionButton>
          </div>
        )}
      </div>
    </RoutedDialog>
  );
}
