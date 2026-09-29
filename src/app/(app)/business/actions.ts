"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { MARKET_DIRECTORY } from "@/lib/business/directory";
import { syncTendersIfStale } from "@/lib/business/tender-sync";
import { requireOrg } from "@/lib/context";

const PATH = "/business";
const KINDS = ["client", "buyer", "forest_owner", "agency", "contractor", "association", "portal", "other"] as const;
const STATUSES = ["prospect", "contacted", "active", "inactive"] as const;

const contactSchema = z.object({
  company_name: zf.reqText(200),
  kind: z.enum(KINDS).default("client"),
  status: z.enum(STATUSES).default("prospect"),
  country_id: zf.optUuid(),
  contact_name: zf.text(200).optional(),
  role: zf.text(120).optional(),
  phone: zf.text(50).optional(),
  email: zf.text(200).optional(),
  website: zf.text(300).optional(),
  last_contact_at: zf.optDate(),
  next_action: zf.text(300).optional(),
  next_action_at: zf.optDate(),
  notes: zf.text(5000).optional(),
});

const nul = <T,>(v: T | undefined) => (v === undefined || v === "" ? null : v);

function row(d: z.infer<typeof contactSchema>) {
  return {
    company_name: d.company_name, kind: d.kind, status: d.status, country_id: nul(d.country_id), contact_name: nul(d.contact_name),
    role: nul(d.role), phone: nul(d.phone), email: nul(d.email?.toLowerCase()), website: nul(d.website),
    last_contact_at: nul(d.last_contact_at), next_action: nul(d.next_action), next_action_at: nul(d.next_action_at), notes: nul(d.notes),
  };
}

export async function createContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(contactSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("business_contacts").insert({ ...row(parsed.data), organization_id: ctx.org.id, created_by: ctx.user.id });
  if (error) return dbFail("contact.create", error);
  revalidatePath(PATH);
  return { ok: true, message: "Kontakts pievienots" };
}

export async function updateContact(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(contactSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("business_contacts").update(row(parsed.data)).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("contact.update", error);
  revalidatePath(PATH);
  return { ok: true, message: "Saglabāts" };
}

export async function deleteContact(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("business_contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("contact.delete", error);
  revalidatePath(PATH);
  return { ok: true, message: "Kontakts dzēsts" };
}

/** Loads the market directory (LVM, Södra, SCA, Land og skógur, portals …) — skips what exists. */
export async function loadDirectory(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const { data: existing } = await ctx.supabase.from("business_contacts").select("seed_key").eq("organization_id", ctx.org.id).not("seed_key", "is", null);
  const have = new Set((existing ?? []).map((r) => r.seed_key));
  const rows = MARKET_DIRECTORY.filter((e) => !have.has(e.key)).map((e) => ({
    organization_id: ctx.org.id, seed_key: e.key, company_name: e.company, kind: e.kind, status: "prospect",
    website: e.website, notes: e.note, country_id: ctx.countries.find((c) => c.code === e.country)?.id ?? null, created_by: ctx.user.id,
  }));
  if (rows.length) {
    const { error } = await ctx.supabase.from("business_contacts").insert(rows);
    if (error) return dbFail("contact.seed", error);
  }
  revalidatePath(PATH);
  return { ok: true, message: rows.length ? `Pievienoti ${rows.length} tirgus dalībnieki` : "Viss jau ir sarakstā" };
}

const leadFromSchema = z.object({
  title: zf.reqText(200),
  source: z.enum(["felling_notice", "tender"]),
  external_ref: zf.reqText(100),
  country: z.enum(["LV", "SE", "IS"]).optional(),
  latitude: zf.optNum(-90, 90),
  longitude: zf.optNum(-180, 180),
  area_ha: zf.optNum(0, 1_000_000),
  estimated_value: zf.optNum(0, 1_000_000_000),
  currency: zf.text(3).optional(),
  next_action_at: zf.optDate(),
  notes: zf.text(2000).optional(),
});

/** One click from a tender / felling notice → opportunity in the pipeline (deduplicated by reference). */
export async function addLeadFrom(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(leadFromSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { data: dup } = await ctx.supabase.from("forest_leads").select("id").eq("organization_id", ctx.org.id)
    .eq("external_ref", d.external_ref).is("deleted_at", null).maybeSingle();
  if (dup) return { ok: true, message: "Jau ir iespēju sarakstā" };
  const currency = ["EUR", "SEK", "ISK", "NOK", "USD"].includes(d.currency ?? "") ? d.currency! : d.country === "SE" ? "SEK" : d.country === "IS" ? "ISK" : "EUR";
  const { error } = await ctx.supabase.from("forest_leads").insert({
    organization_id: ctx.org.id, title: d.title, source: d.source, status: "new", external_ref: d.external_ref,
    work_type: d.source === "felling_notice" ? "final_felling" : null,
    country_id: d.country ? ctx.countries.find((c) => c.code === d.country)?.id ?? null : null,
    latitude: d.latitude ?? null, longitude: d.longitude ?? null, area_ha: d.area_ha ?? null,
    estimated_value: d.estimated_value ?? null, currency, notes: d.notes ?? null,
    next_action: d.source === "tender" ? "Sagatavot piedāvājumu" : "Sazināties ar meža īpašnieku / pircēju",
    next_action_at: d.next_action_at ?? null, created_by: ctx.user.id, assigned_to: ctx.user.id,
  });
  if (error) return dbFail("lead.from", error);
  revalidatePath(PATH);
  revalidatePath("/forest-map");
  return { ok: true, message: "Pievienots iespējām" };
}

/** "Atjaunot" — pulls the newest IUB / TED notices right now. */
export async function refreshTenders(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects") && !ctx.can("view_finance")) return fail(ctx.t("errors.permission"));
  const r = await syncTendersIfStale({ force: true });
  revalidatePath(PATH);
  if (!r.ok) return fail(r.error === "no-service-role" ? "Serverim nav piekļuves atslēgas (service role)." : "Avots īslaicīgi neatbild — mēģini vēlāk.");
  return { ok: true, message: r.added ? `Atrasti ${r.added} jauni paziņojumi` : "Jaunu paziņojumu nav — viss ir aktuāls" };
}
