"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { localInputToUtc, todayIn } from "@/lib/format";

const CATEGORIES = ["harvester", "forwarder", "tractor", "skidder", "mulcher", "truck", "trailer", "van", "car", "other"] as const;
const STATUSES = ["active", "idle", "maintenance", "broken", "offline"] as const;
const MAINTENANCE_TYPES = ["service", "inspection", "oil_change", "tyres", "other"] as const;

const optInt = (min: number, max: number) =>
  z.coerce.number({ error: "Jābūt skaitlim" }).int("Jābūt veselam skaitlim").min(min, `Minimums ${min}`).max(max, `Maksimums ${max}`).optional();

const machineSchema = z.object({
  name: zf.reqText(120),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES).default("active"),
  manufacturer: zf.text(120).optional(),
  model: zf.text(120).optional(),
  year: optInt(1950, 2100),
  vin: zf.text(40).optional(),
  registration_number: zf.text(40).optional(),
  internal_code: zf.text(40).optional(),
  country_id: zf.optUuid(),
  company_id: zf.optUuid(),
  fuel_type: zf.text(40).optional(),
  engine_hours: zf.optNum(0, 10_000_000),
  mileage_km: zf.optNum(0, 100_000_000),
  service_interval_hours: optInt(1, 100_000),
  last_service_hours: zf.optNum(0, 10_000_000),
  last_service_at: zf.optDate(),
  next_service_hours: zf.optNum(0, 10_000_000),
  next_service_at: zf.optDate(),
  insurance_valid_until: zf.optDate(),
  inspection_valid_until: zf.optDate(),
  notes: zf.text(4000).optional(),
});

type MachineInput = z.infer<typeof machineSchema>;

/** Explicit nulls so clearing a field in the edit form actually clears it. */
function machineRow(d: MachineInput) {
  return {
    name: d.name,
    category: d.category,
    status: d.status,
    manufacturer: d.manufacturer ?? null,
    model: d.model ?? null,
    year: d.year ?? null,
    vin: d.vin ? d.vin.toUpperCase().replace(/\s+/g, "") : null,
    registration_number: d.registration_number ? d.registration_number.toUpperCase() : null,
    internal_code: d.internal_code ?? null,
    country_id: d.country_id ?? null,
    fuel_type: d.fuel_type ?? null,
    engine_hours: d.engine_hours ?? null,
    mileage_km: d.mileage_km ?? null,
    service_interval_hours: d.service_interval_hours ?? null,
    last_service_hours: d.last_service_hours ?? null,
    last_service_at: d.last_service_at ?? null,
    next_service_hours: d.next_service_hours ?? null,
    next_service_at: d.next_service_at ?? null,
    insurance_valid_until: d.insurance_valid_until ?? null,
    inspection_valid_until: d.inspection_valid_until ?? null,
    notes: d.notes ?? null,
  };
}

/** company_id only when the form rendered the company select (organization has companies). */
function companyPatch(d: MachineInput, fd: FormData) {
  return fd.has("company_id") ? { company_id: d.company_id ?? null } : {};
}

function machineError(scope: string, error: { code?: string; message?: string; details?: string | null }, t: (k: "machines.vinTaken") => string) {
  if (/uq_machines_vin/.test(`${error.message ?? ""} ${error.details ?? ""}`)) return fail(t("machines.vinTaken"), { vin: t("machines.vinTaken") });
  return dbFail(scope, error);
}

export async function createMachine(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_machines")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(machineSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { data, error } = await ctx.supabase.from("machines")
    .insert({ ...machineRow(parsed.data), ...companyPatch(parsed.data, fd), organization_id: ctx.org.id, created_by: ctx.user.id })
    .select("id").single();
  if (error) return machineError("machine.create", error, ctx.t);
  revalidatePath("/machines");
  if (fd.get("_stay") === "1") { revalidatePath("/setup"); return { ok: true }; } // setup wizard
  redirect(`/machines/${data.id}`);
}

export async function updateMachine(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_machines")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(machineSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("machines").update({ ...machineRow(parsed.data), ...companyPatch(parsed.data, fd) }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return machineError("machine.update", error, ctx.t);
  revalidatePath(`/machines/${id}`);
  revalidatePath("/machines");
  return { ok: true };
}

export async function changeMachineStatus(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_machines", "manage_repairs")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(z.object({ status: z.enum(STATUSES) }), fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("machines").update({ status: parsed.data.status }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("machine.status", error);
  revalidatePath(`/machines/${id}`);
  revalidatePath("/machines");
  revalidatePath("/maintenance");
  return { ok: true };
}

export async function archiveMachine(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_machines")) return fail(ctx.t("errors.permission"));
  const now = new Date().toISOString();
  // close the open usage record so history stays truthful
  await ctx.supabase.from("machine_assignments").update({ ended_at: now }).eq("machine_id", id).eq("organization_id", ctx.org.id).is("ended_at", null).lte("started_at", now);
  const { error } = await ctx.supabase.from("machines").update({ archived_at: now, current_operator_id: null }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("machine.archive", error);
  revalidatePath("/machines");
  redirect("/machines");
}

/* ------------------------------------------------------------------ usage / operator assignment */
const assignSchema = z.object({
  employee_id: zf.uuid(),
  project_id: zf.optUuid(),
  started_at: zf.optDateTimeLocal(),
});

export async function assignOperator(machineId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_machines")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(assignSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const startedIso = d.started_at ? localInputToUtc(d.started_at, ctx.timezone) : new Date().toISOString();
  if (new Date(startedIso).getTime() > Date.now() + 5 * 60_000) return fail(ctx.t("errors.invalidDate"), { started_at: ctx.t("errors.invalidDate") });

  const { data: machine } = await ctx.supabase.from("machines").select("id, country_id, current_project_id")
    .eq("id", machineId).eq("organization_id", ctx.org.id).maybeSingle();
  if (!machine) return fail(ctx.t("errors.notFound"));
  const projectId = d.project_id ?? machine.current_project_id ?? null;
  let countryId = machine.country_id;
  if (projectId) {
    const { data: p } = await ctx.supabase.from("projects").select("country_id").eq("id", projectId).eq("organization_id", ctx.org.id).maybeSingle();
    countryId = p?.country_id ?? countryId;
  }

  // one operator at a time: close the previous open usage at the new start time
  const { error: endErr } = await ctx.supabase.from("machine_assignments").update({ ended_at: startedIso })
    .eq("machine_id", machineId).eq("organization_id", ctx.org.id).is("ended_at", null).lte("started_at", startedIso);
  if (endErr) return dbFail("machine.assign.close", endErr);

  const { error } = await ctx.supabase.from("machine_assignments").insert({
    organization_id: ctx.org.id, machine_id: machineId, employee_id: d.employee_id, project_id: projectId,
    country_id: countryId, started_at: startedIso, source: "manual", created_by: ctx.user.id,
  });
  if (error) return dbFail("machine.assign", error);

  const { error: mErr } = await ctx.supabase.from("machines").update({ current_operator_id: d.employee_id, current_project_id: projectId })
    .eq("id", machineId).eq("organization_id", ctx.org.id);
  if (mErr) return dbFail("machine.assign.current", mErr);

  if (d.project_id) {
    const { data: link } = await ctx.supabase.from("project_machines").select("id")
      .eq("project_id", d.project_id).eq("machine_id", machineId).is("unassigned_at", null).maybeSingle();
    if (!link) {
      await ctx.supabase.from("project_machines").insert({ organization_id: ctx.org.id, project_id: d.project_id, machine_id: machineId, assigned_by: ctx.user.id });
    }
  }
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  return { ok: true };
}

export async function endAssignment(assignmentId: string, machineId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_machines")) return fail(ctx.t("errors.permission"));
  const { data: a, error } = await ctx.supabase.from("machine_assignments").update({ ended_at: new Date().toISOString() })
    .eq("id", assignmentId).eq("organization_id", ctx.org.id).is("ended_at", null).select("employee_id").maybeSingle();
  if (error) return dbFail("machine.assign.end", error);
  if (a) {
    await ctx.supabase.from("machines").update({ current_operator_id: null })
      .eq("id", machineId).eq("organization_id", ctx.org.id).eq("current_operator_id", a.employee_id);
  }
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  return { ok: true };
}

/* ------------------------------------------------------------------ maintenance records */
const maintenanceSchema = z.object({
  machine_id: zf.uuid(),
  performed_at: zf.date(),
  maintenance_type: z.enum(MAINTENANCE_TYPES).default("service"),
  engine_hours: zf.optNum(0, 10_000_000),
  mileage_km: zf.optNum(0, 100_000_000),
  description: zf.text(4000).optional(),
  cost: zf.optNum(0, 10_000_000),
  currency: zf.currency().default("EUR"),
  performed_by_employee_id: zf.optUuid(),
  external_service: zf.text(200).optional(),
  next_service_hours: zf.optNum(0, 10_000_000),
  next_service_at: zf.optDate(),
});

/** machineId bound from a machine page; null → taken from the form (maintenance hub). */
export async function addMaintenanceRecord(machineId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_machines", "manage_repairs")) return fail(ctx.t("errors.permission"));
  if (machineId) fd.set("machine_id", machineId);
  const parsed = parseForm(maintenanceSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.performed_at > todayIn(ctx.timezone)) return fail(ctx.t("errors.invalidDate"), { performed_at: ctx.t("errors.invalidDate") });
  const { error } = await ctx.supabase.from("maintenance_records").insert({
    organization_id: ctx.org.id, machine_id: d.machine_id, performed_at: d.performed_at, maintenance_type: d.maintenance_type,
    engine_hours: d.engine_hours ?? null, mileage_km: d.mileage_km ?? null, description: d.description ?? null,
    cost: d.cost ?? null, currency: d.currency, performed_by_employee_id: d.performed_by_employee_id ?? null,
    external_service: d.external_service ?? null, next_service_hours: d.next_service_hours ?? null, next_service_at: d.next_service_at ?? null,
    created_by: ctx.user.id,
  });
  if (error) return dbFail("maintenance.create", error);
  revalidatePath(`/machines/${d.machine_id}`);
  revalidatePath("/machines");
  revalidatePath("/maintenance");
  return { ok: true };
}
