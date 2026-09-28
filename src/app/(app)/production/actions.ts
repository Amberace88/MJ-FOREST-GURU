"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

const UNITS = ["m3", "units", "loads", "other"] as const;

const productionSchema = z.object({
  project_id: zf.uuid(),
  work_site_id: zf.optUuid(),
  production_date: zf.date(),
  employee_id: zf.optUuid(),
  team_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  quantity: zf.posNum(99_999.99),
  unit: z.enum(UNITS),
  unit_label: zf.text(40).optional(),
  work_type: zf.text(80).optional(),
  notes: zf.text(2000).optional(),
});

export async function createProduction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(productionSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.unit === "other" && !d.unit_label?.trim()) {
    return fail(ctx.t("errors.validation"), { unit_label: ctx.t("production.unitLabelRequired") });
  }
  // only leads may record production for somebody else
  const canPickEmployee = ctx.canAny("manage_projects", "view_team", "edit_employee_hours");
  const employeeId = canPickEmployee ? d.employee_id ?? null : ctx.employee?.id ?? null;

  if (d.work_site_id) {
    const { data: site } = await ctx.supabase.from("work_sites").select("id").eq("id", d.work_site_id).eq("project_id", d.project_id).maybeSingle();
    if (!site) return fail(ctx.t("errors.validation"), { work_site_id: ctx.t("production.siteMismatch") });
  }

  const { error } = await ctx.supabase.from("production_logs").insert({
    organization_id: ctx.org.id,
    project_id: d.project_id,
    work_site_id: d.work_site_id ?? null,
    production_date: d.production_date,
    employee_id: employeeId,
    team_id: d.team_id ?? null,
    machine_id: d.machine_id ?? null,
    quantity: d.quantity,
    unit: d.unit,
    unit_label: d.unit === "other" ? d.unit_label!.trim() : null,
    work_type: d.work_type ?? null,
    notes: d.notes ?? null,
    created_by: ctx.user.id,
  });
  if (error) return dbFail("production.create", error);
  revalidatePath("/production");
  revalidatePath(`/projects/${d.project_id}`);
  return { ok: true, message: ctx.t("production.saved") };
}

/** Soft delete (creator or project lead — RLS production_update). */
export async function archiveProduction(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
  // no RETURNING: the soft-deleted row is hidden by the SELECT policy
  const { error } = await ctx.supabase.from("production_logs").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("production.archive", error);
  revalidatePath("/production");
  return { ok: true, message: ctx.t("production.archived") };
}
