"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { localInputToUtc } from "@/lib/format";

const STATUSES = ["todo", "in_progress", "waiting", "done", "cancelled"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskStatus = (typeof STATUSES)[number];

const taskSchema = z.object({
  title: zf.reqText(200),
  description: zf.text(4000).optional(),
  project_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  team_id: zf.optUuid(),
  assignee_employee_id: zf.optUuid(),
  priority: z.enum(PRIORITIES).default("medium"),
  deadline: zf.optDateTimeLocal(),
});

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

export async function createTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(taskSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const manager = ctx.can("manage_tasks");
  // without manage_tasks a user may only create tasks for themselves (RLS tasks_insert)
  const assignee = manager ? d.assignee_employee_id ?? null : ctx.employee?.id ?? null;
  if (!manager && !assignee) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("tasks").insert({
    organization_id: ctx.org.id,
    title: d.title,
    description: d.description ?? null,
    project_id: d.project_id ?? null,
    machine_id: d.machine_id ?? null,
    team_id: manager ? d.team_id ?? null : null,
    assignee_employee_id: assignee,
    priority: d.priority,
    deadline: d.deadline ? localInputToUtc(d.deadline, ctx.timezone) : null,
    status: "todo",
    position: Date.now(),
    created_by: ctx.user.id,
  });
  if (error) return dbFail("task.create", error);
  revalidatePath("/tasks");
  return { ok: true, message: ctx.t("tasks.created") };
}

export async function updateTask(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_tasks")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(taskSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data, error } = await ctx.supabase.from("tasks").update({
    title: d.title,
    description: d.description ?? null,
    project_id: d.project_id ?? null,
    machine_id: d.machine_id ?? null,
    team_id: d.team_id ?? null,
    assignee_employee_id: d.assignee_employee_id ?? null,
    priority: d.priority,
    deadline: d.deadline ? localInputToUtc(d.deadline, ctx.timezone) : null,
  }).eq("id", id).eq("organization_id", ctx.org.id).select("id").maybeSingle();
  if (error) return dbFail("task.update", error);
  if (!data) return fail(ctx.t("errors.notFound"));
  revalidatePath("/tasks");
  return { ok: true };
}

/**
 * Status change used by the kanban drag & drop and the status controls.
 * Assignees without manage_tasks may change only the status (DB trigger).
 */
export async function updateTaskStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!isUuid(id) || !(STATUSES as readonly string[]).includes(status)) return fail(ctx.t("errors.validation"));
  const { data, error } = await ctx.supabase.from("tasks").update({ status, position: Date.now() })
    .eq("id", id).eq("organization_id", ctx.org.id).select("id").maybeSingle();
  if (error) return dbFail("task.status", error);
  if (!data) return fail(ctx.t("errors.permission"));
  revalidatePath("/tasks");
  return { ok: true, message: ctx.label("tasks.status", status) };
}

/** Form variant (one-click buttons): expects a `status` field. */
export async function setTaskStatus(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return updateTaskStatus(id, String(fd.get("status") ?? ""));
}

/** Soft delete (managers only). */
export async function archiveTask(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_tasks")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  // no RETURNING: soft-deleted rows are hidden by the SELECT policy
  const { error } = await ctx.supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("task.archive", error);
  revalidatePath("/tasks");
  redirect("/tasks");
}
