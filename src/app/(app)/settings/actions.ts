"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import type { Json } from "@/lib/database.types";
import { ALERT_RULES, IDENTIFIER_FIELDS, LOOKUP_KINDS, isValidTimezone } from "./constants";

async function settingsCtx() {
  const ctx = await requireOrg();
  return ctx;
}

const tz = () => z.string().max(64).refine(isValidTimezone, "Nederīga laika josla");

/* ------------------------------------------------------------ company + defaults */
const companySchema = z.object({
  name: zf.reqText(200).refine((s) => s.trim().length >= 2, "Minimums 2 rakstzīmes"),
  legal_name: zf.text(200).optional(),
  registration_number: zf.text(60).optional(),
  default_language: z.literal("lv"),
  default_timezone: tz(),
  default_currency: zf.currency(),
});

export async function updateCompany(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(companySchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.name !== ctx.org.name) {
    const { error } = await ctx.supabase.from("organizations").update({ name: d.name.trim() }).eq("id", ctx.org.id);
    if (error) return dbFail("settings.company_name", error);
  }
  const { error } = await ctx.supabase.from("organization_settings").update({
    legal_name: d.legal_name ?? null, registration_number: d.registration_number ?? null,
    default_language: d.default_language, default_timezone: d.default_timezone, default_currency: d.default_currency,
  }).eq("organization_id", ctx.org.id);
  if (error) return dbFail("settings.company", error);
  revalidatePath("/", "layout");
  return { ok: true, message: ctx.t("settings.saved") };
}

/* ------------------------------------------------------------ work rules */
const rulesSchema = z.object({
  overtime_after_hours: zf.num(1, 24),
  max_shift_hours: zf.num(1, 24),
  missing_checkout_after_hours: zf.num(1, 48),
  service_warning_hours: z.coerce.number({ error: "Jābūt skaitlim" }).int("Jābūt veselam skaitlim").min(0, "Minimums 0").max(5000, "Maksimums 5000"),
});

export async function updateWorkRules(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(rulesSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.missing_checkout_after_hours < d.max_shift_hours) {
    const msg = ctx.t("errors.validation");
    return fail(msg, { missing_checkout_after_hours: `≥ ${d.max_shift_hours}` });
  }
  const { error } = await ctx.supabase.from("organization_settings").update(d).eq("organization_id", ctx.org.id);
  if (error) return dbFail("settings.rules", error);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: ctx.t("settings.saved") };
}

/* ------------------------------------------------------------ alert rules */
export async function updateAlertConfig(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const { data: current } = await ctx.supabase.from("organization_settings").select("alert_config").eq("organization_id", ctx.org.id).maybeSingle();
  const base = current?.alert_config && typeof current.alert_config === "object" && !Array.isArray(current.alert_config)
    ? (current.alert_config as Record<string, Json | undefined>) : {};
  const next: Record<string, Json | undefined> = { ...base };
  for (const rule of ALERT_RULES) next[rule] = fd.get(rule) === "on";
  const { error } = await ctx.supabase.from("organization_settings").update({ alert_config: next }).eq("organization_id", ctx.org.id);
  if (error) return dbFail("settings.alerts", error);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  return { ok: true, message: ctx.t("settings.saved") };
}

/* ------------------------------------------------------------ countries */
const countrySchema = z.object({
  code: z.string({ error: "Obligāts lauks" }).trim().toUpperCase().regex(/^[A-Z]{2}$/, "Divi lielie burti"),
  name: zf.reqText(80),
  flag: zf.text(16).optional(),
  timezone: tz(),
  currency: zf.currency(),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  site_identifier_fields: z.array(z.enum(IDENTIFIER_FIELDS)).default([]),
});

export async function saveCountry(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(countrySchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const row = {
    name: d.name, flag: d.flag ?? null, timezone: d.timezone, currency: d.currency, sort_order: d.sort_order,
    site_identifier_fields: Array.from(new Set(d.site_identifier_fields)),
  };
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
    // The ISO code is the stable identity of a country and is not editable.
    const { error } = await ctx.supabase.from("countries").update(row).eq("id", id).eq("organization_id", ctx.org.id);
    if (error) return dbFail("settings.country_update", error);
  } else {
    const { error } = await ctx.supabase.from("countries").insert({ ...row, code: d.code, organization_id: ctx.org.id, is_active: true });
    if (error) return dbFail("settings.country_create", error);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: ctx.t("settings.saved") };
}

export async function setCountryActive(id: string, active: boolean, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("countries").update({ is_active: active }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("settings.country_toggle", error);
  revalidatePath("/", "layout");
  return { ok: true, message: ctx.t("settings.saved") };
}

/* ------------------------------------------------------------ lookup values */
const lookupSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,60}$/, "a-z, 0-9, _").optional(),
  label: zf.reqText(120),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function saveLookup(kind: string, id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  const k = z.enum(LOOKUP_KINDS).safeParse(kind);
  if (!k.success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(lookupSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
    // key is referenced by existing records (work_type, fuel_type…) → immutable after creation
    const { error } = await ctx.supabase.from("lookup_values").update({ label: d.label, sort_order: d.sort_order })
      .eq("id", id).eq("organization_id", ctx.org.id).eq("kind", k.data);
    if (error) return dbFail("settings.lookup_update", error);
  } else {
    if (!d.key) return fail(ctx.t("errors.validation"), { key: "Obligāts lauks" });
    const { error } = await ctx.supabase.from("lookup_values").insert({
      organization_id: ctx.org.id, kind: k.data, key: d.key, label: d.label, sort_order: d.sort_order, is_active: true,
    });
    if (error) return dbFail("settings.lookup_create", error);
  }
  revalidatePath("/settings");
  return { ok: true, message: ctx.t("settings.saved") };
}

export async function setLookupActive(id: string, active: boolean, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await settingsCtx();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("lookup_values").update({ is_active: active }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("settings.lookup_toggle", error);
  revalidatePath("/settings");
  return { ok: true, message: ctx.t("settings.saved") };
}
