"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

const IDENTIFIER_KEYS = ["cirsmas_numurs", "kadastra_numurs", "fastighet", "work_site_id", "local_description", "location_name"] as const;

const projectSchema = z.object({
  code: zf.reqText(40),
  name: zf.reqText(200),
  country_id: zf.uuid(),
  client_name: zf.text(200).optional(),
  status: z.enum(["planned", "active", "paused", "completed", "cancelled"]).default("planned"),
  location_name: zf.text(200).optional(),
  address: zf.text(300).optional(),
  latitude: zf.optNum(-90, 90),
  longitude: zf.optNum(-180, 180),
  area_ha: zf.optNum(0, 100000),
  start_date: zf.optDate(),
  expected_end_date: zf.optDate(),
  actual_end_date: zf.optDate(),
  notes: zf.text(4000).optional(),
});

function identifiersFrom(fd: FormData) {
  const out: Record<string, string> = {};
  for (const k of IDENTIFIER_KEYS) {
    const v = String(fd.get(`id_${k}`) ?? "").trim();
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

export async function createProject(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.expected_end_date && d.start_date && d.expected_end_date < d.start_date) return fail(ctx.t("errors.endBeforeStart"), { expected_end_date: ctx.t("errors.endBeforeStart") });
  const { data, error } = await ctx.supabase.from("projects").insert({
    ...d, code: d.code.toUpperCase(), organization_id: ctx.org.id, site_identifiers: identifiersFrom(fd), created_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("project.create", error);
  revalidatePath("/projects");
  if (fd.get("_stay") === "1") { revalidatePath("/setup"); return { ok: true }; } // setup wizard stays on its step
  redirect(`/projects/${data.id}`);
}

export async function updateProject(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(projectSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { error } = await ctx.supabase.from("projects").update({
    ...d, code: d.code.toUpperCase(), site_identifiers: identifiersFrom(fd),
    latitude: d.latitude ?? null, longitude: d.longitude ?? null, area_ha: d.area_ha ?? null,
    start_date: d.start_date ?? null, expected_end_date: d.expected_end_date ?? null, actual_end_date: d.actual_end_date ?? null,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("project.update", error);
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function archiveProject(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { error } = await ctx.supabase.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("project.archive", error);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function assignWorker(projectId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(z.object({ employee_id: zf.uuid(), project_role: z.enum(["worker", "foreman", "manager", "mechanic"]).default("worker") }), fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("project_workers").insert({ organization_id: ctx.org.id, project_id: projectId, ...parsed.data, assigned_by: ctx.user.id });
  if (error) return dbFail("project.assign_worker", error);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function unassignWorker(assignmentId: string, projectId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { error } = await ctx.supabase.from("project_workers").update({ unassigned_at: new Date().toISOString() }).eq("id", assignmentId);
  if (error) return dbFail("project.unassign_worker", error);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function assignMachine(projectId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(z.object({ machine_id: zf.uuid() }), fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("project_machines").insert({ organization_id: ctx.org.id, project_id: projectId, machine_id: parsed.data.machine_id, assigned_by: ctx.user.id });
  if (error) return dbFail("project.assign_machine", error);
  if (ctx.can("manage_machines")) {
    await ctx.supabase.from("machines").update({ current_project_id: projectId }).eq("id", parsed.data.machine_id);
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function unassignMachine(linkId: string, projectId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { error } = await ctx.supabase.from("project_machines").update({ unassigned_at: new Date().toISOString() }).eq("id", linkId);
  if (error) return dbFail("project.unassign_machine", error);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function assignTeam(projectId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(z.object({ team_id: zf.uuid() }), fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("project_teams").insert({ organization_id: ctx.org.id, project_id: projectId, team_id: parsed.data.team_id });
  if (error) return dbFail("project.assign_team", error);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addWorkSite(projectId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(z.object({ name: zf.reqText(200), latitude: zf.optNum(-90, 90), longitude: zf.optNum(-180, 180), area_ha: zf.optNum(0, 100000), notes: zf.text(2000).optional() }), fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("work_sites").insert({ organization_id: ctx.org.id, project_id: projectId, ...parsed.data, site_identifiers: identifiersFrom(fd) });
  if (error) return dbFail("project.add_site", error);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
