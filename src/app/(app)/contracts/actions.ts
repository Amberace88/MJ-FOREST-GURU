"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { CONTRACT_SOURCES, CONTRACT_STATUSES, CURRENCIES, MILESTONE_KINDS, PRICING_MODELS, WORK_TYPES } from "@/lib/contracts";

const PATH = "/contracts";
const uuid = z.string().uuid();
const optUuid = z.string().uuid().optional();

const contractSchema = z.object({
  title: zf.reqText(200),
  number: zf.text(100).optional(),
  client_name: zf.text(200).optional(),
  contact_id: optUuid,
  country_id: optUuid,
  company_id: optUuid,
  project_id: optUuid,
  work_type: z.enum(WORK_TYPES).default("harvesting"),
  source: z.enum(CONTRACT_SOURCES).default("private"),
  status: z.enum(CONTRACT_STATUSES).default("negotiation"),
  signed_at: zf.optDate(),
  start_date: zf.optDate(),
  end_date: zf.optDate(),
  notice_date: zf.optDate(),
  pricing_model: z.enum(PRICING_MODELS).default("per_m3"),
  unit_price: zf.optNum(0, 1_000_000),
  total_value: zf.optNum(0, 10_000_000_000),
  currency: z.enum(CURRENCIES).default("EUR"),
  volume_m3: zf.optNum(0, 10_000_000),
  area_ha: zf.optNum(0, 1_000_000),
  payment_terms_days: zf.optNum(0, 365),
  guarantee: zf.text(500).optional(),
  penalties: zf.text(2000).optional(),
  external_ref: zf.text(200).optional(),
  location: zf.text(300).optional(),
  notes: zf.text(5000).optional(),
}).refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, { path: ["end_date"], message: "Beigas nevar būt pirms sākuma" });

function row(d: z.infer<typeof contractSchema>) {
  return {
    title: d.title, number: d.number ?? null, client_name: d.client_name ?? null, contact_id: d.contact_id ?? null,
    country_id: d.country_id ?? null, company_id: d.company_id ?? null, project_id: d.project_id ?? null,
    work_type: d.work_type, source: d.source, status: d.status, signed_at: d.signed_at ?? null, start_date: d.start_date ?? null,
    end_date: d.end_date ?? null, notice_date: d.notice_date ?? null, pricing_model: d.pricing_model, unit_price: d.unit_price ?? null,
    total_value: d.total_value ?? null, currency: d.currency, volume_m3: d.volume_m3 ?? null, area_ha: d.area_ha ?? null,
    payment_terms_days: d.payment_terms_days != null ? Math.round(d.payment_terms_days) : null, guarantee: d.guarantee ?? null,
    penalties: d.penalties ?? null, external_ref: d.external_ref ?? null, location: d.location ?? null, notes: d.notes ?? null,
  };
}

export async function createContract(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(contractSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { data, error } = await ctx.supabase.from("contracts")
    .insert({ ...row(parsed.data), organization_id: ctx.org.id, created_by: ctx.user.id, responsible_user: ctx.user.id })
    .select("id").single();
  if (error) return dbFail("contract.create", error);
  revalidatePath(PATH);
  redirect(`/contracts/${data.id}`);
}

export async function updateContract(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(contractSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { error } = await ctx.supabase.from("contracts").update(row(parsed.data)).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("contract.update", error);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  return { ok: true, message: "Līgums saglabāts" };
}

export async function setContractStatus(id: string, status: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  const st = z.enum(CONTRACT_STATUSES).safeParse(status);
  if (!uuid.safeParse(id).success || !st.success) return fail(ctx.t("errors.validation"));
  const patch: { status: string; signed_at?: string } = { status: st.data };
  if (st.data === "signed" || st.data === "active") {
    const { data: c } = await ctx.supabase.from("contracts").select("signed_at").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
    if (c && !c.signed_at) patch.signed_at = new Date().toISOString().slice(0, 10);
  }
  const { error } = await ctx.supabase.from("contracts").update(patch).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("contract.status", error);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  return { ok: true, message: "Statuss mainīts" };
}

export async function archiveContract(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("contracts").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("contract.archive", error);
  revalidatePath(PATH);
  redirect(PATH);
}

/** Won opportunity → contract in negotiation, prefilled from the lead (deduplicated). */
export async function contractFromLead(leadId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(leadId).success) return fail(ctx.t("errors.validation"));
  const { data: existing } = await ctx.supabase.from("contracts").select("id").eq("organization_id", ctx.org.id).eq("lead_id", leadId).is("deleted_at", null).maybeSingle();
  if (existing) redirect(`/contracts/${existing.id}`);
  const { data: l } = await ctx.supabase.from("forest_leads")
    .select("id, title, source, work_type, country_id, company_id, project_id, contact_id, area_ha, volume_m3, price_per_m3, estimated_value, currency, owner_name, external_ref, notes")
    .eq("id", leadId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!l) return fail(ctx.t("errors.notFound"));
  const workType = ({ final_felling: "harvesting", thinning: "thinning", planting: "planting", young_stand: "young_stand", road: "road" } as Record<string, string>)[l.work_type ?? ""] ?? "harvesting";
  const { data, error } = await ctx.supabase.from("contracts").insert({
    organization_id: ctx.org.id, lead_id: l.id, project_id: l.project_id, contact_id: l.contact_id, country_id: l.country_id, company_id: l.company_id,
    title: l.title.replace(/^Iepirkums:\s*/, "").slice(0, 200), client_name: l.owner_name, work_type: workType,
    source: l.source === "tender" ? "tender" : "private", status: "negotiation", pricing_model: "per_m3",
    unit_price: l.price_per_m3, total_value: l.estimated_value, currency: l.currency, volume_m3: l.volume_m3, area_ha: l.area_ha,
    external_ref: l.external_ref, notes: l.notes, created_by: ctx.user.id, responsible_user: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("contract.fromLead", error);
  revalidatePath(PATH);
  redirect(`/contracts/${data.id}`);
}

/** Contract without a work site yet → planned project (code <COUNTRY>-<nnn>), linked both ways. */
export async function projectFromContract(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { data: c } = await ctx.supabase.from("contracts")
    .select("id, title, client_name, country_id, company_id, project_id, area_ha, start_date, end_date, location, notes, lead_id")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!c) return fail(ctx.t("errors.notFound"));
  if (c.project_id) return { ok: true, message: "Objekts jau piesaistīts" };
  const country = ctx.countries.find((x) => x.id === c.country_id) ?? ctx.country ?? ctx.countries[0];
  if (!country) return fail("Vispirms iestatījumos aktivizējiet valsti");
  const { data: existing } = await ctx.supabase.from("projects").select("code").eq("organization_id", ctx.org.id).ilike("code", `${country.code}-%`);
  let n = Math.max(0, ...(existing ?? []).map((p) => Number(p.code.split("-").pop()) || 0)) + 1;
  for (let attempt = 0; attempt < 5; attempt++, n++) {
    const code = `${country.code}-${String(n).padStart(3, "0")}`;
    const { data: proj, error } = await ctx.supabase.from("projects").insert({
      organization_id: ctx.org.id, country_id: country.id, company_id: c.company_id, code, name: c.title, status: "planned",
      client_name: c.client_name, area_ha: c.area_ha, start_date: c.start_date, expected_end_date: c.end_date,
      location_name: c.location, notes: c.notes, created_by: ctx.user.id,
    }).select("id").single();
    if (error?.code === "23505") continue;
    if (error) return dbFail("contract.project", error);
    await ctx.supabase.from("contracts").update({ project_id: proj.id }).eq("id", id).eq("organization_id", ctx.org.id);
    if (c.lead_id) await ctx.supabase.from("forest_leads").update({ project_id: proj.id, status: "won" }).eq("id", c.lead_id).eq("organization_id", ctx.org.id);
    revalidatePath(`${PATH}/${id}`);
    revalidatePath("/projects");
    return { ok: true, message: `Izveidots darba objekts ${code}` };
  }
  return fail(ctx.t("errors.generic"));
}

// MILESTONES ------------------------------------------------------------------------------------
const milestoneSchema = z.object({
  kind: z.enum(MILESTONE_KINDS).default("deadline"),
  title: zf.reqText(200),
  due_date: zf.optDate(),
  amount: zf.optNum(0, 10_000_000_000),
  notes: zf.text(2000).optional(),
});

export async function addMilestone(contractId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(contractId).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(milestoneSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { error } = await ctx.supabase.from("contract_milestones").insert({
    organization_id: ctx.org.id, contract_id: contractId, kind: d.kind, title: d.title, due_date: d.due_date ?? null,
    amount: d.amount ?? null, notes: d.notes ?? null, created_by: ctx.user.id,
  });
  if (error) return dbFail("milestone.add", error);
  revalidatePath(`${PATH}/${contractId}`);
  revalidatePath(PATH);
  return { ok: true, message: "Pievienots" };
}

export async function toggleMilestone(id: string, contractId: string, done: boolean, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("contract_milestones").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("milestone.toggle", error);
  revalidatePath(`${PATH}/${contractId}`);
  revalidatePath(PATH);
  return { ok: true, message: done ? "Atzīmēts kā izpildīts" : "Atjaunots" };
}

export async function removeMilestone(id: string, contractId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_projects")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("contract_milestones").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("milestone.remove", error);
  revalidatePath(`${PATH}/${contractId}`);
  return { ok: true, message: "Dzēsts" };
}
