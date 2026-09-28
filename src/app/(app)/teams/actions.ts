"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

const teamSchema = z.object({
  name: zf.reqText(100),
  country_id: zf.optUuid(),
  manager_employee_id: zf.optUuid(),
  foreman_employee_id: zf.optUuid(),
});

export async function createTeam(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_teams")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(teamSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data, error } = await ctx.supabase.from("teams").insert({
    organization_id: ctx.org.id, name: d.name, country_id: d.country_id ?? null,
    manager_employee_id: d.manager_employee_id ?? null, foreman_employee_id: d.foreman_employee_id ?? null,
  }).select("id").single();
  if (error) return dbFail("team.create", error);
  // Leaders are members of their own team (only when the user may edit employees; RLS enforces it anyway).
  if (ctx.can("edit_employees")) {
    const leaders = [d.manager_employee_id, d.foreman_employee_id].filter((x): x is string => Boolean(x));
    if (leaders.length) await ctx.supabase.from("employees").update({ team_id: data.id }).in("id", leaders).eq("organization_id", ctx.org.id).is("team_id", null);
  }
  revalidatePath("/teams");
  redirect(`/teams/${data.id}`);
}

export async function updateTeam(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_teams")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(teamSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { error } = await ctx.supabase.from("teams").update({
    name: d.name, country_id: d.country_id ?? null,
    manager_employee_id: d.manager_employee_id ?? null, foreman_employee_id: d.foreman_employee_id ?? null,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("team.update", error);
  revalidatePath(`/teams/${id}`);
  revalidatePath("/teams");
  return { ok: true };
}

export async function archiveTeam(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_teams")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("teams").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("team.archive", error);
  if (ctx.can("edit_employees")) {
    await ctx.supabase.from("employees").update({ team_id: null }).eq("team_id", id).eq("organization_id", ctx.org.id);
  }
  revalidatePath("/teams");
  redirect("/teams");
}

export async function addTeamMember(teamId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(z.object({ "employee_ids": z.array(z.string().uuid()).min(1, "Obligāts lauks").max(200) }), fd);
  if (!parsed.ok) return parsed.result;
  const { data: team } = await ctx.supabase.from("teams").select("id").eq("id", teamId).eq("organization_id", ctx.org.id).is("archived_at", null).maybeSingle();
  if (!team) return fail(ctx.t("errors.notFound"));
  const { error } = await ctx.supabase.from("employees").update({ team_id: teamId })
    .in("id", parsed.data.employee_ids).eq("organization_id", ctx.org.id);
  if (error) return dbFail("team.add_member", error);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  return { ok: true };
}

export async function removeTeamMember(teamId: string, employeeId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("employees").update({ team_id: null })
    .eq("id", employeeId).eq("team_id", teamId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("team.remove_member", error);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  return { ok: true };
}
