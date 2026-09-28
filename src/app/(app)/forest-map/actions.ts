"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_WORK_TYPES } from "@/lib/forest/leads";

const PATH = "/forest-map";
const uuid = z.string().uuid();

const leadSchema = z.object({
  title: zf.reqText(200),
  status: z.enum(LEAD_STATUSES).default("new"),
  source: z.enum(LEAD_SOURCES).default("other"),
  work_type: z.enum(LEAD_WORK_TYPES).optional(),
  country_id: zf.optUuid(),
  company_id: zf.optUuid(),
  latitude: zf.optNum(-90, 90),
  longitude: zf.optNum(-180, 180),
  area_ha: zf.optNum(0, 1_000_000),
  volume_m3: zf.optNum(0, 10_000_000),
  price_per_m3: zf.optNum(0, 100_000),
  estimated_value: zf.optNum(0, 1_000_000_000),
  currency: z.enum(["EUR", "SEK", "ISK", "NOK", "USD"]).default("EUR"),
  probability: zf.optNum(0, 100),
  cadastre_no: zf.text(100).optional(),
  external_ref: zf.text(100).optional(),
  owner_name: zf.text(200).optional(),
  contact_phone: zf.text(50).optional(),
  contact_email: zf.text(200).optional(),
  next_action: zf.text(300).optional(),
  next_action_at: zf.optDate(),
  notes: zf.text(5000).optional(),
});

function clean<T extends Record<string, unknown>>(d: T) {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" || v === undefined ? null : v])) as { [K in keyof T]: Exclude<T[K], undefined> | null };
}

export async function createLead(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = clean(parsed.data);
  const { error } = await ctx.supabase.from("forest_leads").insert({
    ...d, title: parsed.data.title, status: parsed.data.status, source: parsed.data.source, currency: parsed.data.currency,
    probability: d.probability == null ? null : Math.round(Number(d.probability)),
    organization_id: ctx.org.id, created_by: ctx.user.id, assigned_to: ctx.user.id,
  });
  if (error) return dbFail("lead.create", error);
  revalidatePath(PATH);
  return { ok: true, message: "Iespēja pievienota" };
}

export async function updateLead(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(leadSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = clean(parsed.data);
  const { error } = await ctx.supabase.from("forest_leads").update({
    ...d, title: parsed.data.title, status: parsed.data.status, source: parsed.data.source, currency: parsed.data.currency,
    probability: d.probability == null ? null : Math.round(Number(d.probability)),
    // recompute from volume × price unless the user typed a value
    estimated_value: d.estimated_value ?? (d.volume_m3 != null && d.price_per_m3 != null ? Math.round(Number(d.volume_m3) * Number(d.price_per_m3) * 100) / 100 : null),
  }).eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
  if (error) return dbFail("lead.update", error);
  revalidatePath(PATH);
  return { ok: true, message: "Saglabāts" };
}

export async function setLeadStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const s = z.enum(LEAD_STATUSES).safeParse(status);
  if (!uuid.safeParse(id).success || !s.success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("forest_leads").update({ status: s.data }).eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
  if (error) return dbFail("lead.status", error);
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteLead(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("forest_leads").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("lead.delete", error);
  revalidatePath(PATH);
  return { ok: true, message: "Iespēja dzēsta" };
}

/** Won → creates a planned project at the same place (code = <COUNTRY>-<nnn>) and links it. */
export async function convertLeadToProject(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { data: lead } = await ctx.supabase.from("forest_leads")
    .select("id, title, country_id, company_id, latitude, longitude, area_ha, owner_name, cadastre_no, external_ref, notes, project_id")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!lead) return fail(ctx.t("errors.notFound"));
  if (lead.project_id) return { ok: true, message: "Objekts jau izveidots", data: { projectId: lead.project_id } };
  const country = ctx.countries.find((c) => c.id === lead.country_id) ?? ctx.country ?? ctx.countries[0];
  if (!country) return fail("Vispirms iestatījumos aktivizējiet valsti");

  const { data: existing } = await ctx.supabase.from("projects").select("code").eq("organization_id", ctx.org.id).ilike("code", `${country.code}-%`);
  let n = Math.max(0, ...(existing ?? []).map((p) => Number(p.code.split("-").pop()) || 0)) + 1;
  const identifiers: Record<string, string> = {};
  if (lead.cadastre_no) identifiers[country.code === "SE" ? "fastighet" : "kadastra_numurs"] = lead.cadastre_no;
  if (lead.external_ref) identifiers.work_site_id = lead.external_ref;

  for (let attempt = 0; attempt < 5; attempt++, n++) {
    const code = `${country.code}-${String(n).padStart(3, "0")}`;
    const { data: proj, error } = await ctx.supabase.from("projects").insert({
      organization_id: ctx.org.id, country_id: country.id, company_id: lead.company_id, code, name: lead.title, status: "planned",
      client_name: lead.owner_name, latitude: lead.latitude, longitude: lead.longitude, area_ha: lead.area_ha,
      site_identifiers: identifiers, notes: lead.notes, created_by: ctx.user.id,
    }).select("id").single();
    if (error?.code === "23505") continue; // code taken by a concurrent insert → next number
    if (error) return dbFail("lead.convert", error);
    await ctx.supabase.from("forest_leads").update({ project_id: proj.id, status: "won" }).eq("id", id).eq("organization_id", ctx.org.id);
    revalidatePath(PATH);
    revalidatePath("/projects");
    return { ok: true, message: `Izveidots darba objekts ${code}`, data: { projectId: proj.id } };
  }
  return fail(ctx.t("errors.generic"));
}
