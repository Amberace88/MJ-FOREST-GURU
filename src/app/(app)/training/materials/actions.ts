"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { generateDocument } from "@/lib/training/ai";
import { AUDIENCE_KEYS } from "@/lib/training/categories";
import { estimateReadingMinutes } from "@/lib/training/format";
import { splitLines } from "@/lib/training/generator";
import { hashBody, syncBuiltins } from "@/lib/training/materials";
import { MATERIAL_CATEGORIES } from "@/lib/training/types";

const audienceField = z.array(z.enum(AUDIENCE_KEYS as [string, ...string[]])).max(6).optional();

const generatorSchema = z.object({
  title: zf.reqText(200),
  category: z.enum(MATERIAL_CATEGORIES),
  country_id: zf.optUuid(),
  audience: audienceField,
  purpose: zf.reqText(3000),
  events: zf.text(8000).optional(),
  requirements: zf.text(6000).optional(),
  forbidden: zf.text(4000).optional(),
  responsible: zf.text(200).optional(),
});

const editorSchema = z.object({
  title: zf.reqText(200),
  subtitle: zf.text(400).optional(),
  summary: zf.text(2000).optional(),
  category: z.enum(MATERIAL_CATEGORIES),
  country_id: zf.optUuid(),
  audience: audienceField,
  reading_minutes: zf.optNum(1, 600),
  requires_acknowledgement: zf.bool(),
  body: zf.reqText(200000),
  intent: z.enum(["draft", "publish"]).default("draft"),
});

function revalidate(id?: string) {
  revalidatePath("/training");
  if (id) revalidatePath(`/training/materials/${id}`);
}

/** Current employee confirms the CURRENT version (server time, immutable row). */
export async function acknowledgeMaterial(materialId: string, version: number, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.employee) return fail(ctx.t("materials.noEmployee"));
  const ids = z.object({ id: zf.uuid(), v: z.number().int().min(1) }).safeParse({ id: materialId, v: version });
  if (!ids.success) return fail(ctx.t("errors.validation"));
  const { data: m } = await ctx.supabase.from("training_materials").select("id, version, status")
    .eq("id", materialId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!m || m.status !== "published") return fail(ctx.t("errors.notFound"));
  if (m.version !== version) return fail(ctx.t("materials.ackOutdated"));
  const { error } = await ctx.supabase.from("training_material_acks").insert({
    organization_id: ctx.org.id, material_id: materialId, version, employee_id: ctx.employee.id, user_id: ctx.user.id,
  });
  if (error && error.code !== "23505") {
    if (/INVALID_ACKNOWLEDGEMENT/.test(error.message)) return fail(ctx.t("materials.ackOutdated"));
    return dbFail("materials.acknowledge", error);
  }
  revalidate(materialId);
  return { ok: true, message: ctx.t("materials.ackRecorded") };
}

/** "Atjaunot standarta materiālus": inserts missing, restores deleted and resets edited built-ins. */
export async function restoreBuiltinMaterials(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const n = await syncBuiltins(ctx, { force: true });
  revalidate();
  return { ok: true, message: ctx.t("materials.restored", { n }) };
}

/** Generator → new draft → opens in the editor. */
export async function generateMaterial(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(generatorSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const country = d.country_id ? ctx.countries.find((c) => c.id === d.country_id) : null;
  if (d.country_id && !country) return fail(ctx.t("errors.validation"), { country_id: ctx.t("errors.notFound") });
  const audience = [...new Set(d.audience ?? [])];

  const doc = await generateDocument({
    title: d.title, category: d.category, countryName: country?.name ?? null,
    audienceLabels: audience.map((a) => ctx.label("materials.audiences", a)),
    purpose: d.purpose, events: d.events ?? "", requirements: splitLines(d.requirements), forbidden: splitLines(d.forbidden),
    responsible: d.responsible ?? null,
  });

  const sourceNotes = [
    `Mērķis: ${d.purpose}`, d.events && `Notikumi: ${d.events}`, d.requirements && `Prasības:\n${d.requirements}`,
    d.forbidden && `Aizliegts:\n${d.forbidden}`, d.responsible && `Atbildīgais: ${d.responsible}`, `Avots: ${doc.source === "ai" ? "AI" : "veidne"}`,
  ].filter(Boolean).join("\n\n").slice(0, 20000);

  const { data, error } = await ctx.supabase.from("training_materials").insert({
    organization_id: ctx.org.id, category: d.category, country_id: country?.id ?? null, title: d.title, subtitle: null,
    summary: doc.summary, audience, body: doc.body, status: "draft", requires_acknowledgement: true,
    reading_minutes: doc.readingMinutes, source_notes: sourceNotes, created_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("materials.generate", error);
  revalidate();
  redirect(`/training/materials/${data.id}/edit?generated=${doc.source}`);
}

/** Editor save. Publishing a changed body of an already published material bumps the version. */
export async function saveMaterial(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.notFound"));
  const parsed = parseForm(editorSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.country_id && !ctx.countries.some((c) => c.id === d.country_id)) return fail(ctx.t("errors.validation"), { country_id: ctx.t("errors.notFound") });

  const { data: cur } = await ctx.supabase.from("training_materials")
    .select("id, version, status, published_hash, builtin_key, is_customized, title, subtitle, summary, category, country_id, audience, body, requires_acknowledgement")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!cur) return fail(ctx.t("errors.notFound"));

  const body = d.body.replace(/\r\n?/g, "\n");
  const hash = hashBody(body);
  const publish = d.intent === "publish";
  const bump = publish && cur.status === "published" && Boolean(cur.published_hash) && cur.published_hash !== hash;
  const audience = [...new Set(d.audience ?? [])];
  const contentChanged = hashBody(cur.body) !== hash || cur.title !== d.title || (cur.subtitle ?? "") !== (d.subtitle ?? "")
    || (cur.summary ?? "") !== (d.summary ?? "") || cur.category !== d.category || (cur.country_id ?? null) !== (d.country_id ?? null)
    || [...cur.audience].sort().join() !== [...audience].sort().join() || cur.requires_acknowledgement !== d.requires_acknowledgement;

  const { error } = await ctx.supabase.from("training_materials").update({
    title: d.title, subtitle: d.subtitle ?? null, summary: d.summary ?? null, category: d.category, country_id: d.country_id ?? null,
    audience, reading_minutes: d.reading_minutes ?? estimateReadingMinutes(body), requires_acknowledgement: d.requires_acknowledgement,
    body, status: publish ? "published" : "draft",
    ...(publish ? { published_hash: hash, published_at: bump || cur.status !== "published" ? new Date().toISOString() : undefined } : {}),
    version: bump ? cur.version + 1 : cur.version,
    is_customized: cur.is_customized || (Boolean(cur.builtin_key) && contentChanged),
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("materials.save", error);
  revalidate(id);
  if (!publish) return { ok: true, message: ctx.t("materials.editor.saved") };
  return { ok: true, message: bump ? ctx.t("materials.editor.publishedNewVersion", { n: cur.version + 1 }) : ctx.t("materials.editor.publishedMsg") };
}

export async function deleteMaterial(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_safety")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.notFound"));
  const { error } = await ctx.supabase.from("training_materials").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
  if (error) return dbFail("materials.delete", error);
  revalidate(id);
  redirect("/training");
}
