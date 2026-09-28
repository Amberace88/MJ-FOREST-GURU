"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg, type OrgContext } from "@/lib/context";

const ENTITY_TYPES = ["employee", "machine", "project", "organization"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];
const VISIBILITY = ["management", "entity", "organization"] as const;
const TYPE_KEY = z.string().regex(/^[a-z0-9_]{1,60}$/, "Nederīga vērtība");

const createSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: zf.optUuid(),
  name: zf.reqText(200),
  document_type: TYPE_KEY.default("other"),
  issued_at: zf.optDate(),
  expiry_date: zf.optDate(),
  visibility: z.enum(VISIBILITY).default("management"),
  notes: zf.text(4000).optional(),
  file_id: zf.optUuid(),
});

const updateSchema = createSchema.pick({ name: true, document_type: true, issued_at: true, expiry_date: true, visibility: true, notes: true });

const versionSchema = z.object({
  issued_at: zf.optDate(),
  expiry_date: zf.optDate(),
  notes: zf.text(4000).optional(),
  file_id: zf.optUuid(),
});

/** Ensures the target record exists in this org and is visible to the user (RLS). */
async function entityExists(ctx: OrgContext, type: EntityType, id: string | undefined): Promise<string | null> {
  if (type === "organization") return ctx.org.id;
  if (!id) return null;
  const table = type === "employee" ? "employees" : type === "machine" ? "machines" : "projects";
  const { data } = await ctx.supabase.from(table).select("id").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  return data?.id ?? null;
}

/** The uploaded file must belong to this org and to the same entity as the document. */
async function fileMatches(ctx: OrgContext, fileId: string | undefined, type: string, entityId: string | null) {
  if (!fileId) return true;
  const { data } = await ctx.supabase.from("files").select("id, entity_type, entity_id")
    .eq("id", fileId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  return Boolean(data && data.entity_type === type && (data.entity_id ?? ctx.org.id) === entityId);
}

async function validTypeKey(ctx: OrgContext, key: string) {
  if (key === "other") return true;
  const { data } = await ctx.supabase.from("lookup_values").select("key").eq("organization_id", ctx.org.id).eq("kind", "document_type").eq("key", key).maybeSingle();
  return Boolean(data);
}

function revalidateEntity(type: string, id: string | null) {
  revalidatePath("/documents");
  if (id && type === "employee") revalidatePath(`/employees/${id}`);
  if (id && type === "machine") revalidatePath(`/machines/${id}`);
  if (id && type === "project") revalidatePath(`/projects/${id}`);
}

export async function createDocument(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(createSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.issued_at && d.expiry_date && d.expiry_date < d.issued_at) return fail(ctx.t("errors.endBeforeStart"), { expiry_date: ctx.t("errors.endBeforeStart") });
  const entityId = await entityExists(ctx, d.entity_type, d.entity_id);
  if (!entityId) return fail(ctx.t("errors.validation"), { entity_id: ctx.t("documents.chooseEntityFirst") });
  if (!(await validTypeKey(ctx, d.document_type))) return fail(ctx.t("errors.validation"), { document_type: ctx.t("errors.validation") });
  if (!(await fileMatches(ctx, d.file_id, d.entity_type, entityId))) return fail(ctx.t("errors.validation"));

  const { data, error } = await ctx.supabase.from("documents").insert({
    organization_id: ctx.org.id, entity_type: d.entity_type, entity_id: entityId, name: d.name, document_type: d.document_type,
    issued_at: d.issued_at ?? null, expiry_date: d.expiry_date ?? null, visibility: d.visibility, notes: d.notes ?? null,
    file_id: d.file_id ?? null, uploaded_by: ctx.user.id, version: 1, status: "active",
  }).select("id").single();
  if (error) return dbFail("document.create", error);
  revalidateEntity(d.entity_type, entityId);
  redirect(`/documents/${data.id}`);
}

export async function updateDocument(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(updateSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.issued_at && d.expiry_date && d.expiry_date < d.issued_at) return fail(ctx.t("errors.endBeforeStart"), { expiry_date: ctx.t("errors.endBeforeStart") });
  if (!(await validTypeKey(ctx, d.document_type))) return fail(ctx.t("errors.validation"), { document_type: ctx.t("errors.validation") });
  const { data, error } = await ctx.supabase.from("documents").update({
    name: d.name, document_type: d.document_type, issued_at: d.issued_at ?? null, expiry_date: d.expiry_date ?? null, visibility: d.visibility, notes: d.notes ?? null,
  }).eq("id", id).eq("organization_id", ctx.org.id).select("entity_type, entity_id").maybeSingle();
  if (error) return dbFail("document.update", error);
  revalidateEntity(data?.entity_type ?? "", data?.entity_id ?? null);
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

/**
 * New version: inserts a copy with version + 1 (new file/dates) and marks the
 * previous row "superseded" — history is kept, nothing is deleted.
 */
export async function newDocumentVersion(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(versionSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.issued_at && d.expiry_date && d.expiry_date < d.issued_at) return fail(ctx.t("errors.endBeforeStart"), { expiry_date: ctx.t("errors.endBeforeStart") });
  const { data: cur } = await ctx.supabase.from("documents").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!cur) return fail(ctx.t("errors.notFound"));
  if (!(await fileMatches(ctx, d.file_id, cur.entity_type, cur.entity_id))) return fail(ctx.t("errors.validation"));

  // Highest version in this document's chain (same entity + type + name).
  let chain = ctx.supabase.from("documents").select("version").eq("organization_id", ctx.org.id).eq("entity_type", cur.entity_type)
    .eq("document_type", cur.document_type).eq("name", cur.name).order("version", { ascending: false }).limit(1);
  chain = cur.entity_id ? chain.eq("entity_id", cur.entity_id) : chain.is("entity_id", null);
  const { data: top } = await chain.maybeSingle();
  const nextVersion = Math.max(cur.version, top?.version ?? 0) + 1;

  const { data: created, error } = await ctx.supabase.from("documents").insert({
    organization_id: ctx.org.id, entity_type: cur.entity_type, entity_id: cur.entity_id, name: cur.name, document_type: cur.document_type,
    issued_at: d.issued_at ?? null, expiry_date: d.expiry_date ?? null, visibility: cur.visibility, notes: d.notes ?? cur.notes,
    file_id: d.file_id ?? null, uploaded_by: ctx.user.id, version: nextVersion, status: "active", is_demo: cur.is_demo,
  }).select("id").single();
  if (error) return dbFail("document.version", error);

  let sup = ctx.supabase.from("documents").update({ status: "superseded" }).eq("organization_id", ctx.org.id).eq("status", "active")
    .eq("entity_type", cur.entity_type).eq("document_type", cur.document_type).eq("name", cur.name).neq("id", created.id);
  sup = cur.entity_id ? sup.eq("entity_id", cur.entity_id) : sup.is("entity_id", null);
  const { error: supErr } = await sup;
  if (supErr) return dbFail("document.supersede", supErr);

  revalidateEntity(cur.entity_type, cur.entity_id);
  redirect(`/documents/${created.id}`);
}

export async function archiveDocument(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  const { data, error } = await ctx.supabase.from("documents").update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", ctx.org.id).select("entity_type, entity_id").maybeSingle();
  if (error) return dbFail("document.archive", error);
  revalidateEntity(data?.entity_type ?? "", data?.entity_id ?? null);
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

export async function restoreDocument(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  const { error } = await ctx.supabase.from("documents").update({ status: "active", archived_at: null })
    .eq("id", id).eq("organization_id", ctx.org.id).eq("status", "archived");
  if (error) return dbFail("document.restore", error);
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true };
}

/** Attach / replace the file of an existing document version (called after a browser upload). */
export async function attachDocumentFile(id: string, fileId: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_documents")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(fileId).success) return fail(ctx.t("errors.validation"));
  const { data: doc } = await ctx.supabase.from("documents").select("entity_type, entity_id").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!doc) return fail(ctx.t("errors.notFound"));
  if (!(await fileMatches(ctx, fileId, doc.entity_type, doc.entity_id))) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("documents").update({ file_id: fileId }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("document.attach", error);
  revalidatePath(`/documents/${id}`);
  revalidateEntity(doc.entity_type, doc.entity_id);
  return { ok: true };
}
