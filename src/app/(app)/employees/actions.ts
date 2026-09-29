"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { grantableRoles, inviteUser } from "@/lib/invite";
import { E164, normalizePhone } from "@/lib/phone";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";

const STATUSES = ["active", "on_leave", "inactive", "offboarding"] as const;

const employeeSchema = z.object({
  first_name: zf.reqText(100),
  last_name: zf.text(100).optional(),
  email: zf.email(),
  phone: z.string({ error: "Obligāts lauks" }).transform(normalizePhone).pipe(z.string().regex(E164, "Tālrunis ar valsts kodu, piem. +371 26123456")),
  whatsapp: z.string().transform(normalizePhone).pipe(z.string().regex(E164, "WhatsApp ar valsts kodu, piem. +371 26123456")).optional(),
  same_whatsapp: z.string().optional(),
  create_account: z.string().optional(),
  role_key: z.enum(ROLE_KEYS as unknown as [string, ...string[]]).optional(),
  job_title: zf.text(120).optional(),
  country_id: zf.optUuid(),
  team_id: zf.optUuid(),
  company_id: zf.optUuid(),
  status: z.enum(STATUSES).default("active"),
  employment_start: zf.optDate(),
  employment_end: zf.optDate(),
  notes: zf.text(4000).optional(),
});

type EmployeeInput = z.infer<typeof employeeSchema>;

/** company_id only when the form rendered the company select (organization has companies). */
function companyPatch(d: EmployeeInput, fd: FormData) {
  return fd.has("company_id") ? { company_id: d.company_id ?? null } : {};
}

function toRow(d: EmployeeInput) {
  return {
    first_name: d.first_name,
    last_name: d.last_name ?? "",
    email: d.email.toLowerCase(),
    phone: d.phone,
    whatsapp: d.same_whatsapp === "1" ? d.phone : d.whatsapp ?? null,
    job_title: d.job_title ?? null,
    country_id: d.country_id ?? null,
    team_id: d.team_id ?? null,
    status: d.status,
    employment_start: d.employment_start ?? null,
    employment_end: d.employment_end ?? null,
    notes: d.notes ?? null,
  };
}

export async function createEmployee(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(employeeSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.employment_end && d.employment_start && d.employment_end < d.employment_start) {
    return fail(ctx.t("errors.endBeforeStart"), { employment_end: ctx.t("errors.endBeforeStart") });
  }
  const { data, error } = await ctx.supabase.from("employees")
    .insert({ ...toRow(d), ...companyPatch(d, fd), organization_id: ctx.org.id, created_by: ctx.user.id })
    .select("id").single();
  if (error) return dbFail("employee.create", error);
  revalidatePath("/employees");

  // Account + one-time invitation link right away (the admin shares it by e-mail / WhatsApp / SMS)
  if (d.create_account === "1" && ctx.can("manage_users")) {
    const role = (d.role_key ?? "employee") as RoleKey;
    if (!grantableRoles(ctx).includes(role)) return fail(ctx.t("users.privilegedRole"));
    const res = await inviteUser({ ctx, email: d.email, fullName: `${d.first_name} ${d.last_name ?? ""}`.trim(), role, employeeId: data.id });
    if (!res.ok) return { ok: false, error: `Darbinieks saglabāts, bet kontu neizdevās izveidot: ${res.error ?? ""}`.trim() };
    if (fd.get("_stay") === "1") revalidatePath("/setup");
    return { ...res, data: res.data ? { ...res.data, to: { email: d.email.toLowerCase(), whatsapp: d.same_whatsapp === "1" ? d.phone : d.whatsapp ?? null, phone: d.phone } } : undefined };
  }
  if (fd.get("_stay") === "1") { revalidatePath("/setup"); return { ok: true }; } // setup wizard
  redirect(`/employees/${data.id}`);
}

export async function updateEmployee(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(employeeSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.employment_end && d.employment_start && d.employment_end < d.employment_start) {
    return fail(ctx.t("errors.endBeforeStart"), { employment_end: ctx.t("errors.endBeforeStart") });
  }
  const { error } = await ctx.supabase.from("employees").update({ ...toRow(d), ...companyPatch(d, fd) }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("employee.update", error);
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  return { ok: true };
}

export async function archiveEmployee(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("employees")
    .update({ archived_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("employee.archive", error);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function restoreEmployee(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("employees").update({ archived_at: null, status: "active" }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("employee.restore", error);
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  return { ok: true };
}

const compensationSchema = z.object({
  hourly_rate: zf.optNum(0, 100000),
  monthly_salary: zf.optNum(0, 10000000),
  currency: zf.currency().default("EUR"),
});

export async function saveCompensation(employeeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("view_salaries", "edit_employees")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(compensationSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { error } = await ctx.supabase.from("employee_compensation").upsert({
    employee_id: employeeId, organization_id: ctx.org.id,
    hourly_rate: d.hourly_rate ?? null, monthly_salary: d.monthly_salary ?? null, currency: d.currency,
    updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id" });
  if (error) return dbFail("employee.compensation", error);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

/** Links an uploaded avatar (files row, kind=avatar) as the employee photo. */
export async function setEmployeePhoto(employeeId: string, fileId: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employees")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(fileId).success || !z.string().uuid().safeParse(employeeId).success) return fail(ctx.t("errors.validation"));
  const { data: file } = await ctx.supabase.from("files").select("path, bucket, entity_type, entity_id")
    .eq("id", fileId).eq("organization_id", ctx.org.id).maybeSingle();
  if (!file || file.entity_type !== "employee" || file.entity_id !== employeeId || file.bucket !== "media") return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("employees").update({ photo_path: file.path }).eq("id", employeeId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("employee.photo", error);
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { ok: true };
}

/* ------------------------------------------------------------------ invitations */
const inviteSchema = z.object({
  email: zf.email(),
  role_key: z.enum(ROLE_KEYS as unknown as [string, ...string[]]),
});

/**
 * "Uzaicināt sistēmā": sends a Supabase auth invite (service role), grants the
 * membership + role via the service-role RPC, links employees.user_id and logs an
 * invitations row. Requires manage_users (checked with the user's own client first).
 */
export async function inviteEmployee(employeeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(inviteSchema, fd);
  if (!parsed.ok) return parsed.result;
  const email = parsed.data.email.toLowerCase();
  const { data: emp } = await ctx.supabase.from("employees").select("id, full_name, first_name, last_name, email")
    .eq("id", employeeId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!emp) return fail(ctx.t("errors.notFound"));

  // Single invitation implementation shared with Settings → Users (src/lib/invite.ts)
  const res = await inviteUser({
    ctx, email, fullName: emp.full_name ?? `${emp.first_name} ${emp.last_name ?? ""}`.trim(),
    role: parsed.data.role_key as RoleKey, employeeId,
  });
  if (!res.ok) return res;
  if (emp.email?.toLowerCase() !== email) {
    await ctx.supabase.from("employees").update({ email }).eq("id", employeeId).eq("organization_id", ctx.org.id);
  }
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return res;
}
