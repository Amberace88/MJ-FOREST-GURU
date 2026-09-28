import "server-only";
import type { OrgContext } from "@/lib/context";

export type EntityRef = { type: string; id: string | null };

/** Display names + links for document owners (employees / machines / projects / organization). */
export async function entityNames(ctx: OrgContext, refs: EntityRef[]) {
  const ids = (t: string) => Array.from(new Set(refs.filter((r) => r.type === t && r.id).map((r) => r.id as string)));
  const [emps, machines, projects] = await Promise.all([
    ids("employee").length ? ctx.supabase.from("employees").select("id, full_name").eq("organization_id", ctx.org.id).in("id", ids("employee")) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ids("machine").length ? ctx.supabase.from("machines").select("id, name").eq("organization_id", ctx.org.id).in("id", ids("machine")) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ids("project").length ? ctx.supabase.from("projects").select("id, code, name").eq("organization_id", ctx.org.id).in("id", ids("project")) : Promise.resolve({ data: [] as { id: string; code: string; name: string }[] }),
  ]);
  const out = new Map<string, { name: string; href: string | null }>();
  for (const e of emps.data ?? []) out.set(`employee:${e.id}`, { name: e.full_name ?? "—", href: `/employees/${e.id}` });
  for (const m of machines.data ?? []) out.set(`machine:${m.id}`, { name: m.name, href: `/machines/${m.id}` });
  for (const p of projects.data ?? []) out.set(`project:${p.id}`, { name: `${p.code} · ${p.name}`, href: `/projects/${p.id}` });
  return (r: EntityRef) => (r.type === "organization" ? { name: ctx.org.name, href: null } : out.get(`${r.type}:${r.id}`) ?? { name: "—", href: null });
}

/** Signed URL for a stored file (files RLS + storage RLS decide whether the user may open it). */
export async function signedFileUrl(ctx: OrgContext, fileId: string | null | undefined) {
  if (!fileId) return null;
  const { data: f } = await ctx.supabase.from("files").select("bucket, path, original_name, mime_type").eq("id", fileId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!f) return null;
  const { data } = await ctx.supabase.storage.from(f.bucket).createSignedUrl(f.path, 60 * 10);
  return data?.signedUrl ? { url: data.signedUrl, name: f.original_name, mime: f.mime_type } : null;
}

/** Expiry filter → date range (cumulative "within N days"). */
export function expiryRange(bucket: string | undefined, today: string, addDays: (d: string, n: number) => string): { lt?: string; gte?: string; lte?: string; gt?: string; none?: boolean } | null {
  switch (bucket) {
    case "expired": return { lt: today };
    case "d7": return { gte: today, lte: addDays(today, 7) };
    case "d14": return { gte: today, lte: addDays(today, 14) };
    case "d30": return { gte: today, lte: addDays(today, 30) };
    case "d60": return { gte: today, lte: addDays(today, 60) };
    case "d90": return { gte: today, lte: addDays(today, 90) };
    case "ok": return { gt: addDays(today, 90) };
    case "none": return { none: true };
    default: return null;
  }
}
