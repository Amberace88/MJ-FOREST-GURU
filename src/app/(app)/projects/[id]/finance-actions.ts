"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { CONTRACT_TYPES, CONTRACT_UNITS } from "@/lib/project-finance";

const schema = z.object({
  contract_type: z.enum(CONTRACT_TYPES).optional(),
  contract_price: zf.optNum(0, 1e12),
  contract_currency: zf.currency(),
  contract_unit: z.enum(CONTRACT_UNITS),
  expected_volume: zf.optNum(0, 1e12),
  budget_hours: zf.optNum(0, 1e9),
  budget_cost: zf.optNum(0, 1e12),
});

/** Edit contract terms and budget of a project (manage_projects + view_finance; RLS enforces project access). */
export async function updateProjectFinance(projectId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects") || !ctx.can("view_finance")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(projectId).success) return fail(ctx.t("errors.notFound"));

  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;

  const { data, error } = await ctx.supabase.from("projects").update({
    contract_type: d.contract_type ?? null,
    contract_price: d.contract_price ?? null,
    contract_currency: d.contract_currency,
    contract_unit: d.contract_unit,
    expected_volume: d.expected_volume ?? null,
    budget_hours: d.budget_hours ?? null,
    budget_cost: d.budget_cost ?? null,
  }).eq("id", projectId).eq("organization_id", ctx.org.id).is("deleted_at", null).select("id");
  if (error) return dbFail("projects.finance", error);
  if (!data?.length) return fail(ctx.t("errors.notFound"));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: ctx.t("finance.saved") };
}
