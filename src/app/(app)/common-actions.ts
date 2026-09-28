"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";

const COMMENT_TYPES = ["task", "repair", "project", "incident", "expense", "employee", "machine"] as const;

export async function addComment(entityType: string, entityId: string, path: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(z.object({ body: zf.reqText(5000) }), fd);
  if (!parsed.ok) return parsed.result;
  if (!COMMENT_TYPES.includes(entityType as (typeof COMMENT_TYPES)[number]) || !z.string().uuid().safeParse(entityId).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("comments").insert({
    organization_id: ctx.org.id, entity_type: entityType, entity_id: entityId, body: parsed.data.body, author_id: ctx.user.id,
  });
  if (error) return dbFail("comment.add", error);
  revalidatePath(path);
  return { ok: true, message: ctx.t("common.success") };
}

const fileSchema = z.object({
  bucket: z.enum(["receipts", "documents", "media"]),
  path: z.string().min(10).max(500),
  entityType: z.enum(["employee", "machine", "project", "organization", "safety_rule", "repair", "expense", "fuel", "incident", "task", "production", "receipt"]),
  entityId: z.string().uuid().nullable(),
  kind: z.enum(["photo", "video", "before", "after", "receipt", "document", "avatar", "other"]),
  originalName: z.string().max(255).optional(),
  mimeType: z.string().max(120).optional(),
  size: z.number().int().min(0).max(52428800).optional(),
});

/** Registers an uploaded storage object (uploaded by the browser under RLS) in public.files. */
export async function registerFile(input: z.infer<typeof fileSchema>, revalidate?: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrg();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return fail(ctx.t("errors.validation"));
  const f = parsed.data;
  if (!f.path.startsWith(`${ctx.org.id}/`)) return fail(ctx.t("errors.permission"));
  const { data, error } = await ctx.supabase.from("files").insert({
    organization_id: ctx.org.id, bucket: f.bucket, path: f.path, entity_type: f.entityType, entity_id: f.entityId, kind: f.kind,
    original_name: f.originalName, mime_type: f.mimeType, size_bytes: f.size, uploaded_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("file.register", error);
  if (revalidate) revalidatePath(revalidate);
  return { ok: true, data: { id: data.id } };
}

/** Soft delete only — storage objects are kept (no silent data loss, audited). */
export async function archiveFile(fileId: string, path: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const { error } = await ctx.supabase.from("files").update({ deleted_at: new Date().toISOString(), deleted_by: ctx.user.id }).eq("id", fileId);
  if (error) return dbFail("file.archive", error);
  revalidatePath(path);
  return { ok: true };
}
