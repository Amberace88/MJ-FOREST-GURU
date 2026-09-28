"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg, type OrgContext } from "@/lib/context";

const recordSchema = z.object({
  employee_id: zf.uuid(),
  training_id: zf.optUuid(),
  title: zf.text(200).optional(),
  completed_at: zf.optDate(),
  expires_at: zf.optDate(),
  certificate_number: zf.text(120).optional(),
  certificate_file_id: zf.optUuid(),
  notes: zf.text(4000).optional(),
});
const recordUpdateSchema = recordSchema.omit({ employee_id: true });

const courseSchema = z.object({
  title: zf.reqText(200),
  description: zf.text(4000).optional(),
  country_id: zf.optUuid(),
  validity_months: z.coerce.number({ error: "Jābūt skaitlim" }).int("Jābūt veselam skaitlim").min(1, "Minimums 1").max(600, "Maksimums 600").optional(),
  is_required: zf.bool(),
  applies_to: zf.text(1000).optional(),
});

function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

async function certificateMatches(ctx: OrgContext, fileId: string | undefined, employeeId: string) {
  if (!fileId) return true;
  const { data } = await ctx.supabase.from("files").select("entity_type, entity_id")
    .eq("id", fileId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  return Boolean(data && data.entity_type === "employee" && data.entity_id === employeeId);
}

/** Resolves title/expiry from the course (validity months) when not given explicitly. */
async function resolveCourse(ctx: OrgContext, d: z.infer<typeof recordUpdateSchema>) {
  let title = d.title?.trim() || "";
  let expires = d.expires_at ?? null;
  if (d.training_id) {
    const { data: course } = await ctx.supabase.from("safety_training").select("title, validity_months")
      .eq("id", d.training_id).eq("organization_id", ctx.org.id).maybeSingle();
    if (!course) return null;
    if (!title) title = course.title;
    if (!expires && d.completed_at && course.validity_months) expires = addMonths(d.completed_at, course.validity_months);
  }
  return { title, expires };
}

function revalidateAll(employeeId: string) {
  revalidatePath("/training");
  revalidatePath(`/employees/${employeeId}`);
}

export async function createTrainingRecord(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_safety", "edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(recordSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data: emp } = await ctx.supabase.from("employees").select("id").eq("id", d.employee_id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!emp) return fail(ctx.t("errors.validation"), { employee_id: ctx.t("errors.notFound") });
  const resolved = await resolveCourse(ctx, d);
  if (!resolved) return fail(ctx.t("errors.validation"), { training_id: ctx.t("errors.notFound") });
  if (!resolved.title) return fail(ctx.t("errors.validation"), { title: "Obligāts lauks" });
  if (resolved.expires && d.completed_at && resolved.expires < d.completed_at) return fail(ctx.t("errors.endBeforeStart"), { expires_at: ctx.t("errors.endBeforeStart") });
  if (!(await certificateMatches(ctx, d.certificate_file_id, d.employee_id))) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("employee_training").insert({
    organization_id: ctx.org.id, employee_id: d.employee_id, training_id: d.training_id ?? null, title: resolved.title,
    completed_at: d.completed_at ?? null, expires_at: resolved.expires, certificate_number: d.certificate_number ?? null,
    certificate_file_id: d.certificate_file_id ?? null, notes: d.notes ?? null, created_by: ctx.user.id,
  });
  if (error) return dbFail("training.create", error);
  revalidateAll(d.employee_id);
  return { ok: true };
}

export async function updateTrainingRecord(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_safety", "edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(recordUpdateSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data: cur } = await ctx.supabase.from("employee_training").select("employee_id, certificate_file_id").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!cur) return fail(ctx.t("errors.notFound"));
  const resolved = await resolveCourse(ctx, d);
  if (!resolved) return fail(ctx.t("errors.validation"), { training_id: ctx.t("errors.notFound") });
  if (!resolved.title) return fail(ctx.t("errors.validation"), { title: "Obligāts lauks" });
  if (resolved.expires && d.completed_at && resolved.expires < d.completed_at) return fail(ctx.t("errors.endBeforeStart"), { expires_at: ctx.t("errors.endBeforeStart") });
  if (!(await certificateMatches(ctx, d.certificate_file_id, cur.employee_id))) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("employee_training").update({
    training_id: d.training_id ?? null, title: resolved.title, completed_at: d.completed_at ?? null, expires_at: resolved.expires,
    certificate_number: d.certificate_number ?? null, notes: d.notes ?? null,
    certificate_file_id: d.certificate_file_id ?? cur.certificate_file_id,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("training.update", error);
  revalidateAll(cur.employee_id);
  return { ok: true };
}

function courseRow(d: z.infer<typeof courseSchema>) {
  const titles = (d.applies_to ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  return {
    title: d.title, description: d.description ?? null, country_id: d.country_id ?? null, validity_months: d.validity_months ?? null,
    is_required: d.is_required, applies_to_job_titles: titles.length ? titles : null,
  };
}

export async function createCourse(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(courseSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("safety_training").insert({ organization_id: ctx.org.id, ...courseRow(parsed.data) });
  if (error) return dbFail("training.course_create", error);
  revalidatePath("/training");
  return { ok: true };
}

export async function updateCourse(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(courseSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("safety_training").update(courseRow(parsed.data)).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("training.course_update", error);
  revalidatePath("/training");
  return { ok: true };
}
