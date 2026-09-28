"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg, type OrgContext } from "@/lib/context";

const CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"] as const;
const OWNER_EDITABLE = ["draft", "correction_requested"] as const;

const expenseSchema = z.object({
  expense_date: zf.date(),
  amount: zf.posNum(9_999_999),
  currency: zf.currency(),
  category: z.enum(CATEGORIES),
  project_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  employee_id: zf.optUuid(),
  company_id: zf.optUuid(),
  description: zf.text(2000).optional(),
  receipt_id: zf.optUuid(),
  intent: z.enum(["draft", "submit"]).default("draft"),
});
type ExpenseInput = z.infer<typeof expenseSchema>;

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

/** Mirrors the DB rule (EXPENSE_INCOMPLETE) so the user gets a field-level message before the trigger fires. */
function incomplete(ctx: OrgContext, d: ExpenseInput) {
  if (d.intent === "submit" && !d.receipt_id && !d.description?.trim()) {
    return fail(ctx.t("errors.incompleteExpense"), { description: ctx.t("errors.incompleteExpense") });
  }
  return null;
}

/** Links a freshly uploaded receipt: user-entered expense values become the confirmed receipt values. */
async function linkReceipt(ctx: OrgContext, receiptId: string, d: ExpenseInput) {
  const { data: receipt } = await ctx.supabase.from("receipts").select("id, uploaded_by, ocr_confirmed, amount, receipt_date, currency")
    .eq("id", receiptId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!receipt) return false;
  if (receipt.uploaded_by === ctx.user.id && !receipt.ocr_confirmed) {
    await ctx.supabase.from("receipts").update({
      amount: receipt.amount ?? d.amount, receipt_date: receipt.receipt_date ?? d.expense_date, currency: receipt.currency ?? d.currency, ocr_confirmed: true,
    }).eq("id", receiptId);
  }
  return true;
}

export async function createExpense(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("create_expense")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(expenseSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const bad = incomplete(ctx, d);
  if (bad) return bad;

  const employeeId = ctx.can("view_finance") && d.employee_id ? d.employee_id : ctx.employee?.id ?? null;
  if (!employeeId && !ctx.can("view_finance")) return fail(ctx.t("work.noEmployee"));
  if (d.receipt_id && !(await linkReceipt(ctx, d.receipt_id, d))) return fail(ctx.t("errors.notFound"), { receipt_id: ctx.t("errors.notFound") });

  const { data, error } = await ctx.supabase.from("expenses").insert({
    organization_id: ctx.org.id,
    expense_date: d.expense_date,
    amount: d.amount,
    currency: d.currency,
    category: d.category,
    project_id: d.project_id ?? null,
    machine_id: d.machine_id ?? null,
    employee_id: employeeId,
    description: d.description ?? null,
    receipt_id: d.receipt_id ?? null,
    company_id: d.company_id ?? null, // null → inherited from the project by the DB
    status: d.intent === "submit" ? "submitted" : "draft",
    created_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("expense.create", error);
  revalidatePath("/expenses");
  redirect(`/expenses/${data.id}`);
}

async function loadOwned(ctx: OrgContext, id: string) {
  const { data } = await ctx.supabase.from("expenses").select("id, status, created_by, employee_id")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!data) return null;
  const isOwner = data.created_by === ctx.user.id || (data.employee_id != null && data.employee_id === ctx.employee?.id);
  return { ...data, isOwner };
}

export async function updateExpense(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(expenseSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const bad = incomplete(ctx, d);
  if (bad) return bad;
  const current = await loadOwned(ctx, id);
  if (!current) return fail(ctx.t("errors.notFound"));
  if (!current.isOwner || !(OWNER_EDITABLE as readonly string[]).includes(current.status)) return fail(ctx.t("expenses.lockedHint"));
  if (d.receipt_id && !(await linkReceipt(ctx, d.receipt_id, d))) return fail(ctx.t("errors.notFound"), { receipt_id: ctx.t("errors.notFound") });

  const { error } = await ctx.supabase.from("expenses").update({
    expense_date: d.expense_date,
    amount: d.amount,
    currency: d.currency,
    category: d.category,
    project_id: d.project_id ?? null,
    machine_id: d.machine_id ?? null,
    description: d.description ?? null,
    receipt_id: d.receipt_id ?? null,
    ...(ctx.can("view_finance") && d.employee_id ? { employee_id: d.employee_id } : {}),
    ...(fd.has("company_id") ? { company_id: d.company_id ?? null } : {}),
    status: d.intent === "submit" ? "submitted" : current.status,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("expense.update", error);
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { ok: true, message: d.intent === "submit" ? ctx.t("expenses.submitted") : ctx.t("common.success") };
}

export async function submitExpense(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const current = await loadOwned(ctx, id);
  if (!current) return fail(ctx.t("errors.notFound"));
  if (!current.isOwner || !(OWNER_EDITABLE as readonly string[]).includes(current.status)) return fail(ctx.t("expenses.lockedHint"));
  const { error } = await ctx.supabase.from("expenses").update({ status: "submitted" })
    .eq("id", id).eq("organization_id", ctx.org.id).in("status", [...OWNER_EDITABLE]);
  if (error) return dbFail("expense.submit", error);
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { ok: true, message: ctx.t("expenses.submitted") };
}

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "correction_requested"]),
  comment: zf.text(2000).optional(),
});

/** Approve / reject / request correction. Self-approval and scope are also enforced by the DB trigger. */
export async function decideExpense(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("approve_expense", "view_finance")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(decisionSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { decision, comment } = parsed.data;
  if (decision !== "approved" && !comment?.trim()) {
    return fail(ctx.t("expenses.commentRequired"), { comment: ctx.t("expenses.commentRequired") });
  }
  const { data: current } = await ctx.supabase.from("expenses").select("id, status, created_by")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!current) return fail(ctx.t("errors.notFound"));
  if (current.created_by === ctx.user.id && !ctx.roles.includes("owner")) return fail(ctx.t("errors.selfApproval"));
  if (current.status !== "submitted") return fail(ctx.t("expenses.notPending"));

  const { data, error } = await ctx.supabase.from("expenses").update({ status: decision, decision_comment: comment?.trim() || null })
    .eq("id", id).eq("organization_id", ctx.org.id).eq("status", "submitted").select("id").maybeSingle();
  if (error) return dbFail("expense.decide", error);
  if (!data) return fail(ctx.t("expenses.notPending"));
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { ok: true, message: ctx.label("expenses.status", decision) };
}

export async function markExpensePaid(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("view_finance")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const { data, error } = await ctx.supabase.from("expenses").update({ status: "paid" })
    .eq("id", id).eq("organization_id", ctx.org.id).eq("status", "approved").select("id").maybeSingle();
  if (error) return dbFail("expense.paid", error);
  if (!data) return fail(ctx.t("errors.notFound"));
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  return { ok: true, message: ctx.t("expenses.status.paid") };
}

/** Soft delete of an own draft (never hard-deleted; audited). */
export async function deleteExpense(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const current = await loadOwned(ctx, id);
  if (!current) return fail(ctx.t("errors.notFound"));
  if (!current.isOwner || current.status !== "draft") return fail(ctx.t("expenses.lockedHint"));
  // no RETURNING: a soft-deleted row is no longer visible through the SELECT policy
  const { error } = await ctx.supabase.from("expenses").update({ deleted_at: new Date().toISOString(), deleted_by: ctx.user.id })
    .eq("id", id).eq("organization_id", ctx.org.id).eq("status", "draft");
  if (error) return dbFail("expense.delete", error);
  revalidatePath("/expenses");
  redirect("/expenses");
}
