"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { canTransition, REPAIR_PRIORITIES, REPAIR_STATUSES } from "./workflow";

function revalidateRepair(id: string, machineId?: string | null) {
  revalidatePath(`/repairs/${id}`);
  revalidatePath("/repairs");
  revalidatePath("/maintenance");
  if (machineId) revalidatePath(`/machines/${machineId}`);
}

/* ------------------------------------------------------------------ report a problem */
const reportSchema = z.object({
  machine_id: zf.uuid(),
  project_id: zf.optUuid(),
  category: zf.reqText(60),
  priority: z.enum(REPAIR_PRIORITIES).default("medium"),
  title: zf.reqText(200),
  description: zf.text(4000).optional(),
  location_text: zf.text(200).optional(),
  latitude: zf.optNum(-90, 90),
  longitude: zf.optNum(-180, 180),
  idempotency_key: zf.text(80).optional(),
  photo_ids: z.array(z.string().uuid()).max(30).optional(),
});

export async function createRepair(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data, error } = await ctx.supabase.from("repair_requests").insert({
    organization_id: ctx.org.id, machine_id: d.machine_id, project_id: d.project_id ?? null,
    reported_by_employee_id: ctx.employee?.id ?? null, category: d.category, priority: d.priority, title: d.title,
    description: d.description ?? null, location_text: d.location_text ?? null,
    latitude: d.latitude ?? null, longitude: d.longitude ?? null,
    idempotency_key: d.idempotency_key ?? null, created_by: ctx.user.id,
  }).select("id").single();

  let repairId = data?.id ?? null;
  if (error) {
    // double submit (flaky mobile network): the first request already created it
    if (error.code === "23505" && d.idempotency_key) {
      const { data: existing } = await ctx.supabase.from("repair_requests").select("id")
        .eq("organization_id", ctx.org.id).eq("idempotency_key", d.idempotency_key).maybeSingle();
      repairId = existing?.id ?? null;
    }
    if (!repairId) return dbFail("repair.create", error);
  }
  if (!repairId) return fail(ctx.t("errors.generic"));

  if (d.photo_ids?.length) {
    // photos were uploaded before the repair existed: attach them now (only own, still unattached uploads)
    await ctx.supabase.from("files").update({ entity_id: repairId })
      .in("id", d.photo_ids).eq("organization_id", ctx.org.id).eq("entity_type", "repair").eq("uploaded_by", ctx.user.id).is("entity_id", null);
  }
  revalidateRepair(repairId, d.machine_id);
  redirect(`/repairs/${repairId}`);
}

/* ------------------------------------------------------------------ workflow */
async function loadRepair(ctx: Awaited<ReturnType<typeof requireOrg>>, id: string) {
  const { data } = await ctx.supabase.from("repair_requests").select("id, status, machine_id, assigned_mechanic_id, approved_at")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  return data;
}

export async function changeRepairStatus(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_repairs", "approve_repairs")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(z.object({ status: z.enum(REPAIR_STATUSES) }), fd);
  if (!parsed.ok) return parsed.result;
  const to = parsed.data.status;
  const r = await loadRepair(ctx, id);
  if (!r) return fail(ctx.t("errors.notFound"));
  if (!canTransition(r.status, to)) return fail(ctx.t("repairs.invalidTransition"));
  if (to === "assigned" && !r.assigned_mechanic_id) return fail(ctx.t("repairs.needsMechanic"));
  if (r.status === "completed" && r.approved_at) return fail(ctx.t("repairs.alreadyApproved"));
  const patch: { status: string; completed_at?: null } = { status: to };
  if (r.status === "completed") patch.completed_at = null; // reopened
  const { error } = await ctx.supabase.from("repair_requests").update(patch).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("repair.status", error);
  revalidateRepair(id, r.machine_id);
  return { ok: true, message: ctx.t("repairs.statusChanged") };
}

export async function assignMechanic(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_repairs", "approve_repairs")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(z.object({ assigned_mechanic_id: zf.uuid() }), fd);
  if (!parsed.ok) return parsed.result;
  const r = await loadRepair(ctx, id);
  if (!r) return fail(ctx.t("errors.notFound"));
  if (r.status === "completed" || r.status === "cancelled") return fail(ctx.t("repairs.closedRepair"));
  // the DB moves new/acknowledged → assigned automatically
  const { error } = await ctx.supabase.from("repair_requests").update({ assigned_mechanic_id: parsed.data.assigned_mechanic_id })
    .eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("repair.assign", error);
  revalidateRepair(id, r.machine_id);
  return { ok: true };
}

const workSchema = z.object({
  labour_hours: zf.optNum(0, 10_000),
  labour_cost: zf.optNum(0, 10_000_000),
  external_cost: zf.optNum(0, 10_000_000),
  currency: zf.currency().default("EUR"),
  downtime_hours: zf.optNum(0, 100_000),
  external_service: zf.text(200).optional(),
  resolution: zf.text(4000).optional(),
});

/** Saves labour/cost/resolution; with complete=true also moves the repair to "completed". */
export async function saveRepairWork(id: string, complete: boolean, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_repairs", "approve_repairs")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(workSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const r = await loadRepair(ctx, id);
  if (!r) return fail(ctx.t("errors.notFound"));
  if (complete) {
    if (!canTransition(r.status, "completed")) return fail(ctx.t("repairs.invalidTransition"));
    if (!d.resolution) return fail(ctx.t("errors.validation"), { resolution: ctx.t("repairs.resolutionRequired") });
  }
  const { error } = await ctx.supabase.from("repair_requests").update({
    labour_hours: d.labour_hours ?? null, labour_cost: d.labour_cost ?? null, external_cost: d.external_cost ?? null,
    currency: d.currency, downtime_hours: d.downtime_hours ?? null, external_service: d.external_service ?? null,
    resolution: d.resolution ?? null, ...(complete ? { status: "completed" } : {}),
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail(complete ? "repair.complete" : "repair.work", error);
  revalidateRepair(id, r.machine_id);
  return { ok: true };
}

export async function approveRepair(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("approve_repairs")) return fail(ctx.t("errors.permission"));
  const r = await loadRepair(ctx, id);
  if (!r) return fail(ctx.t("errors.notFound"));
  if (r.status !== "completed") return fail(ctx.t("repairs.approveNeedsCompleted"));
  if (r.approved_at) return { ok: true };
  const { error } = await ctx.supabase.from("repair_requests").update({ approved_at: new Date().toISOString(), approved_by: ctx.user.id })
    .eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("repair.approve", error);
  revalidateRepair(id, r.machine_id);
  return { ok: true, message: ctx.t("repairs.approved") };
}

/* ------------------------------------------------------------------ parts */
const partSchema = z.object({
  name: zf.reqText(200),
  part_number: zf.text(100).optional(),
  quantity: zf.posNum(100_000),
  unit_cost: zf.optNum(0, 10_000_000),
  currency: zf.currency().default("EUR"),
  supplier: zf.text(200).optional(),
});

export async function addRepairPart(repairId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(partSchema, fd);
  if (!parsed.ok) return parsed.result;
  const r = await loadRepair(ctx, repairId);
  if (!r) return fail(ctx.t("errors.notFound"));
  const isMechanic = !!ctx.employee?.id && r.assigned_mechanic_id === ctx.employee.id;
  if (!ctx.can("manage_repairs") && !isMechanic) return fail(ctx.t("errors.permission"));
  const d = parsed.data;
  const { error } = await ctx.supabase.from("repair_parts").insert({
    organization_id: ctx.org.id, repair_id: repairId, name: d.name, part_number: d.part_number ?? null,
    quantity: d.quantity, unit_cost: d.unit_cost ?? null, currency: d.currency, supplier: d.supplier ?? null, created_by: ctx.user.id,
  });
  if (error) return dbFail("repair.part.add", error);
  revalidateRepair(repairId, r.machine_id);
  return { ok: true };
}

export async function removeRepairPart(partId: string, repairId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_repairs")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("repair_parts").delete().eq("id", partId).eq("repair_id", repairId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("repair.part.remove", error);
  revalidateRepair(repairId);
  return { ok: true };
}
