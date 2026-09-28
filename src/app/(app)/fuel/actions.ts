"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { localInputToUtc } from "@/lib/format";

const fuelSchema = z.object({
  machine_id: zf.uuid(),
  project_id: zf.optUuid(),
  employee_id: zf.optUuid(),
  occurred_at: zf.dateTimeLocal(),
  litres: zf.posNum(5000),
  price_per_litre: zf.optNum(0, 1000),
  total_amount: zf.optNum(0, 10_000_000),
  currency: zf.currency().default("EUR"),
  fuel_type: zf.text(40).optional(),
  engine_hours: zf.optNum(0, 10_000_000),
  mileage_km: zf.optNum(0, 100_000_000),
  location_text: zf.text(200).optional(),
  notes: zf.text(2000).optional(),
  idempotency_key: zf.text(80).optional(),
  receipt_file_id: zf.optUuid(),
});

export async function createFuelLog(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(fuelSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  const canEdit = ctx.can("edit_fuel");
  const employeeId = canEdit && d.employee_id ? d.employee_id : ctx.employee?.id ?? null;
  if (!employeeId && !canEdit) return fail(ctx.t("fuel.noEmployeeProfile"));

  const occurredAt = localInputToUtc(d.occurred_at, ctx.timezone);
  if (new Date(occurredAt).getTime() > Date.now() + 10 * 60_000) return fail(ctx.t("errors.invalidDate"), { occurred_at: ctx.t("errors.invalidDate") });

  let receiptId: string | null = null;
  if (d.receipt_file_id) {
    const amount = d.total_amount ?? (d.price_per_litre != null ? Math.round(d.litres * d.price_per_litre * 100) / 100 : null);
    const { data: rec, error: recErr } = await ctx.supabase.from("receipts").insert({
      organization_id: ctx.org.id, file_id: d.receipt_file_id, receipt_date: d.occurred_at.slice(0, 10), amount, currency: d.currency,
      employee_id: employeeId, uploaded_by: ctx.user.id,
    }).select("id").single();
    if (recErr) return dbFail("fuel.receipt", recErr);
    receiptId = rec.id;
  }

  const { data, error } = await ctx.supabase.from("fuel_logs").insert({
    organization_id: ctx.org.id, occurred_at: occurredAt, employee_id: employeeId, machine_id: d.machine_id, project_id: d.project_id ?? null,
    fuel_type: d.fuel_type || "diesel", litres: d.litres, price_per_litre: d.price_per_litre ?? null, total_amount: d.total_amount ?? null,
    currency: d.currency, engine_hours: d.engine_hours ?? null, mileage_km: d.mileage_km ?? null, location_text: d.location_text ?? null,
    notes: d.notes ?? null, receipt_id: receiptId, idempotency_key: d.idempotency_key ?? null, created_by: ctx.user.id,
    source: employeeId && employeeId === ctx.employee?.id ? "employee" : "manual",
  }).select("id").single();

  if (error) {
    if (receiptId) await ctx.supabase.from("receipts").update({ deleted_at: new Date().toISOString() }).eq("id", receiptId);
    const msg = `${error.message ?? ""} ${error.details ?? ""}`;
    if (/uq_fuel_duplicate/.test(msg)) return fail(ctx.t("fuel.duplicate"));
    // same idempotency key → the first submit already saved it (double tap / retry on a weak connection)
    if (error.code === "23505" && /idempotency/.test(msg)) return { ok: true, message: ctx.t("fuel.saved") };
    return dbFail("fuel.create", error);
  }

  if (d.receipt_file_id) {
    await ctx.supabase.from("files").update({ entity_id: data.id })
      .eq("id", d.receipt_file_id).eq("organization_id", ctx.org.id).eq("uploaded_by", ctx.user.id).is("entity_id", null);
  }
  revalidatePath("/fuel");
  revalidatePath(`/machines/${d.machine_id}`);
  return { ok: true, message: ctx.t("fuel.saved") };
}
