"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

const SECTIONS = ["general", "forestry", "machinery", "chainsaw", "ppe", "emergency", "fire", "first_aid", "accident_reporting", "country_specific"] as const;
const ACK_STATEMENT = "Es esmu iepazinies ar šo informāciju.";

const ruleSchema = z.object({
  section: z.enum(SECTIONS),
  title: zf.reqText(200),
  country_id: zf.optUuid(),
  requires_acknowledgement: zf.bool(),
  sort_order: zf.optNum(0, 10000),
});

const bodySchema = z.object({ body: zf.reqText(20000) });

/** Employee acknowledges the CURRENT version of a rule (server time, immutable row). */
export async function acknowledgeRule(ruleId: string, versionId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.employee) return fail(ctx.t("safety.noEmployee"));
  const ids = z.object({ ruleId: zf.uuid(), versionId: zf.uuid() }).safeParse({ ruleId, versionId });
  if (!ids.success) return fail(ctx.t("errors.validation"));

  const [{ data: rule }, { data: version }] = await Promise.all([
    ctx.supabase.from("safety_rules").select("id, current_version, is_active").eq("id", ruleId).eq("organization_id", ctx.org.id).maybeSingle(),
    ctx.supabase.from("safety_rule_versions").select("id, version").eq("id", versionId).eq("rule_id", ruleId).eq("organization_id", ctx.org.id).maybeSingle(),
  ]);
  if (!rule || !version || !rule.is_active) return fail(ctx.t("errors.notFound"));
  // Only the current text can be acknowledged — an outdated page must reload first.
  if (version.version !== rule.current_version) return fail(ctx.t("safety.reackRequired"));

  const { error } = await ctx.supabase.from("safety_acknowledgements").insert({
    organization_id: ctx.org.id, rule_id: ruleId, rule_version_id: versionId, version: version.version,
    employee_id: ctx.employee.id, user_id: ctx.user.id, statement: ACK_STATEMENT,
  });
  if (error && error.code !== "23505") return dbFail("safety.acknowledge", error);
  revalidatePath("/safety");
  return { ok: true, message: ctx.t("safety.ackRecorded") };
}

export async function createRule(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(ruleSchema.extend(bodySchema.shape), fd);
  if (!parsed.ok) return parsed.result;
  const { body, ...d } = parsed.data;
  if (d.country_id && !ctx.countries.some((c) => c.id === d.country_id)) return fail(ctx.t("errors.validation"));

  const { data: rule, error } = await ctx.supabase.from("safety_rules").insert({
    organization_id: ctx.org.id, section: d.section, title: d.title, country_id: d.country_id ?? null,
    requires_acknowledgement: d.requires_acknowledgement, sort_order: d.sort_order ?? 0, current_version: 1, created_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("safety.rule_create", error);

  const { error: vErr } = await ctx.supabase.from("safety_rule_versions").insert({
    organization_id: ctx.org.id, rule_id: rule.id, version: 1, body, created_by: ctx.user.id,
  });
  if (vErr) {
    // Never leave an active rule without text: deactivate it (audited) and report the failure.
    await ctx.supabase.from("safety_rules").update({ is_active: false }).eq("id", rule.id).eq("organization_id", ctx.org.id);
    return dbFail("safety.version_create", vErr);
  }
  revalidatePath("/safety");
  return { ok: true };
}

export async function updateRule(ruleId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(ruleSchema.extend({ is_active: zf.bool() }), fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.country_id && !ctx.countries.some((c) => c.id === d.country_id)) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("safety_rules").update({
    section: d.section, title: d.title, country_id: d.country_id ?? null, requires_acknowledgement: d.requires_acknowledgement,
    is_active: d.is_active, sort_order: d.sort_order ?? 0,
  }).eq("id", ruleId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("safety.rule_update", error);
  revalidatePath("/safety");
  return { ok: true };
}

/**
 * Publishes a new immutable version. Existing acknowledgements keep pointing at
 * the old version, so every employee must acknowledge the new text again.
 */
export async function publishVersion(ruleId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(bodySchema, fd);
  if (!parsed.ok) return parsed.result;

  const [{ data: rule }, { data: latest }] = await Promise.all([
    ctx.supabase.from("safety_rules").select("id, current_version").eq("id", ruleId).eq("organization_id", ctx.org.id).maybeSingle(),
    ctx.supabase.from("safety_rule_versions").select("version, body").eq("rule_id", ruleId).eq("organization_id", ctx.org.id)
      .order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!rule) return fail(ctx.t("errors.notFound"));
  if (latest && latest.body.trim() === parsed.data.body.trim()) return fail(ctx.t("errors.validation"), { body: ctx.t("errors.validation") });
  const next = Math.max(rule.current_version, latest?.version ?? 0) + 1;

  const { error } = await ctx.supabase.from("safety_rule_versions").insert({
    organization_id: ctx.org.id, rule_id: ruleId, version: next, body: parsed.data.body, created_by: ctx.user.id,
  });
  if (error) return dbFail("safety.version_create", error);
  const { error: uErr } = await ctx.supabase.from("safety_rules").update({ current_version: next }).eq("id", ruleId).eq("organization_id", ctx.org.id);
  if (uErr) return dbFail("safety.version_activate", uErr);
  revalidatePath("/safety");
  return { ok: true, message: ctx.t("safety.versionCreated") };
}
