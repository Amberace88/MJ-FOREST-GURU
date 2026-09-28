"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { zonedTimeToUtc } from "@/lib/format";
import { runReceiptOcr } from "./ocr";
import type { ReceiptOcr } from "./types";

const EXPENSE_CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"] as const;

/**
 * Step 2 of the upload flow: the browser has uploaded the photo to the private
 * `receipts` bucket and registered it in `files`; now create the (unconfirmed)
 * receipt row. OCR — if a provider is configured — only fills `ocr_raw`.
 */
export async function createReceiptRecord(input: { receiptId: string; fileId: string }): Promise<ActionResult<{ id: string; ocr: ReceiptOcr | null }>> {
  const ctx = await requireOrg();
  const ids = z.object({ receiptId: z.string().uuid(), fileId: z.string().uuid() }).safeParse(input);
  if (!ids.success) return fail(ctx.t("errors.validation"));
  const { receiptId, fileId } = ids.data;

  const { data: file, error: fileErr } = await ctx.supabase.from("files").select("id, bucket, path, mime_type")
    .eq("id", fileId).eq("organization_id", ctx.org.id).eq("uploaded_by", ctx.user.id).eq("bucket", "receipts").maybeSingle();
  if (fileErr) return dbFail("receipt.file", fileErr);
  if (!file) return fail(ctx.t("errors.notFound"));

  const ocr = await runReceiptOcr(ctx, file);
  const { error } = await ctx.supabase.from("receipts").insert({
    id: receiptId,
    organization_id: ctx.org.id,
    file_id: file.id,
    employee_id: ctx.employee?.id ?? null,
    uploaded_by: ctx.user.id,
    ocr_raw: ocr,
    ocr_confirmed: false,
  });
  if (error) return dbFail("receipt.create", error);
  revalidatePath("/receipts");
  return { ok: true, data: { id: receiptId, ocr } };
}

const confirmSchema = z.object({
  merchant: zf.text(200).optional(),
  receipt_date: zf.optDate(),
  amount: zf.optNum(0, 9_999_999),
  vat_amount: zf.optNum(0, 9_999_999),
  currency: zf.currency(),
  create: z.enum(["none", "expense_draft", "expense_submit", "fuel"]).default("none"),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  project_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  description: zf.text(2000).optional(),
  litres: zf.optNum(0.01, 5000),
  fuel_type: zf.text(40).optional(),
});

/** User-confirmed receipt data (the only way receipt values become trusted), optionally creating an expense or fuel record. */
export async function confirmReceipt(receiptId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!z.string().uuid().safeParse(receiptId).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(confirmSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  if (d.vat_amount != null && d.amount != null && d.vat_amount > d.amount) {
    return fail(ctx.t("errors.validation"), { vat_amount: ctx.t("receipts.vatTooHigh") });
  }
  const creatingExpense = d.create === "expense_draft" || d.create === "expense_submit";
  if (creatingExpense || d.create === "fuel") {
    const fe: Record<string, string> = {};
    if (!d.amount || d.amount <= 0) fe.amount = ctx.t("receipts.requiredForRecord");
    if (!d.receipt_date) fe.receipt_date = ctx.t("receipts.requiredForRecord");
    if (creatingExpense && !d.category) fe.category = ctx.t("receipts.requiredForRecord");
    if (d.create === "fuel" && !d.litres) fe.litres = ctx.t("receipts.requiredForRecord");
    if (Object.keys(fe).length) return fail(ctx.t("errors.validation"), fe);
  }
  if (creatingExpense && !ctx.can("create_expense")) return fail(ctx.t("errors.permission"));

  const { data: receipt, error } = await ctx.supabase.from("receipts").update({
    merchant: d.merchant ?? null,
    receipt_date: d.receipt_date ?? null,
    amount: d.amount ?? null,
    vat_amount: d.vat_amount ?? null,
    currency: d.currency,
    ocr_confirmed: true,
  }).eq("id", receiptId).eq("organization_id", ctx.org.id).select("id").maybeSingle();
  if (error) return dbFail("receipt.confirm", error);
  if (!receipt) return fail(ctx.t("errors.notFound"));
  revalidatePath("/receipts");

  if (creatingExpense) {
    const { data: exp, error: expErr } = await ctx.supabase.from("expenses").insert({
      organization_id: ctx.org.id,
      expense_date: d.receipt_date!,
      amount: d.amount!,
      currency: d.currency,
      category: d.category!,
      project_id: d.project_id ?? null,
      machine_id: d.machine_id ?? null,
      description: d.description || d.merchant || null,
      receipt_id: receiptId,
      employee_id: ctx.employee?.id ?? null,
      status: d.create === "expense_submit" ? "submitted" : "draft",
      created_by: ctx.user.id,
    }).select("id").single();
    if (expErr) return dbFail("receipt.create_expense", expErr);
    revalidatePath("/expenses");
    redirect(`/expenses/${exp.id}`);
  }

  if (d.create === "fuel") {
    const tz = ctx.countries.find((c) => c.currency === d.currency)?.timezone ?? ctx.timezone;
    const { error: fuelErr } = await ctx.supabase.from("fuel_logs").insert({
      organization_id: ctx.org.id,
      occurred_at: zonedTimeToUtc(d.receipt_date!, 12, 0, tz).toISOString(),
      employee_id: ctx.employee?.id ?? null,
      machine_id: d.machine_id ?? null,
      project_id: d.project_id ?? null,
      fuel_type: d.fuel_type || "diesel",
      litres: d.litres!,
      total_amount: d.amount!,
      currency: d.currency,
      location_text: d.merchant ?? null,
      receipt_id: receiptId,
      notes: d.description ?? null,
      source: "employee",
      created_by: ctx.user.id,
    });
    if (fuelErr) return dbFail("receipt.create_fuel", fuelErr);
    revalidatePath("/fuel");
    return { ok: true, message: ctx.t("receipts.fuelCreated") };
  }

  return { ok: true, message: ctx.t("receipts.savedConfirmed") };
}

/** Soft delete (the storage object is kept; receipts are never hard-deleted). */
export async function archiveReceipt(receiptId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!z.string().uuid().safeParse(receiptId).success) return fail(ctx.t("errors.validation"));
  // no RETURNING: the soft-deleted row is no longer visible through the SELECT policy
  const { error } = await ctx.supabase.from("receipts").update({ deleted_at: new Date().toISOString() })
    .eq("id", receiptId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("receipt.archive", error);
  revalidatePath("/receipts");
  redirect("/receipts");
}
