import "server-only";
import { createHash } from "node:crypto";
import type { OrgContext } from "@/lib/context";
import { logServerError } from "@/lib/errors";
import { inAudience } from "./categories";
import { BUILTIN_MATERIALS } from "./library";
import type { BuiltinMaterial, MaterialCategory } from "./types";

export const MATERIAL_LIST_COLUMNS =
  "id, builtin_key, builtin_version, is_customized, category, country_id, title, subtitle, summary, audience, version, status, requires_acknowledgement, reading_minutes, published_at, updated_at";

export type MaterialListRow = {
  id: string; builtin_key: string | null; builtin_version: number | null; is_customized: boolean; category: MaterialCategory;
  country_id: string | null; title: string; subtitle: string | null; summary: string | null; audience: string[]; version: number;
  status: "draft" | "published"; requires_acknowledgement: boolean; reading_minutes: number | null; published_at: string | null; updated_at: string;
};
export type MaterialRow = MaterialListRow & { body: string; source_notes: string | null; published_hash: string | null; deleted_at: string | null };

export type AckRow = { material_id: string; version: number; employee_id: string; acknowledged_at: string };
export type AudienceRow = { employee_id: string; full_name: string; country_id: string | null; roles: string[] };

/** Stable hash of a body — decides whether publishing creates a new version. */
export function hashBody(body: string): string {
  const norm = body.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trim();
  return createHash("sha256").update(norm).digest("hex");
}

function builtinRow(b: BuiltinMaterial, countryId: string | null) {
  return {
    builtin_key: b.key, builtin_version: b.version, is_customized: false, category: b.category, country_id: countryId,
    title: b.title, subtitle: b.subtitle, summary: b.summary, audience: [...b.audience], body: b.body, status: "published" as const,
    requires_acknowledgement: b.requiresAck, reading_minutes: b.readingMinutes, published_hash: hashBody(b.body),
  };
}

/**
 * Loads the standard materials into the organization.
 *  - missing built-ins are inserted (published)
 *  - a newer built-in version replaces the org copy unless the copy was edited or deleted
 *  - `force` (the "Atjaunot standarta materiālus" action) overwrites and restores every built-in
 * Publishing a changed text on an already published copy bumps its version (→ re-acknowledgement).
 * Runs with the user's RLS: only manage_safety can write. Returns the number of changed rows.
 */
export async function syncBuiltins(ctx: OrgContext, opts: { force?: boolean } = {}): Promise<number> {
  if (!ctx.can("manage_safety")) return 0;
  const { data: existing, error } = await ctx.supabase.from("training_materials")
    .select("id, builtin_key, builtin_version, is_customized, version, status, published_hash, deleted_at")
    .eq("organization_id", ctx.org.id).not("builtin_key", "is", null);
  if (error) { logServerError("materials.sync_load", error); return 0; }
  const byKey = new Map((existing ?? []).map((r) => [r.builtin_key as string, r]));

  let changed = 0;
  for (const b of BUILTIN_MATERIALS) {
    const countryId = b.country ? ctx.countries.find((c) => c.code === b.country)?.id ?? null : null;
    if (b.country && !countryId) continue; // organization does not operate in that country
    const cur = byKey.get(b.key);
    const row = builtinRow(b, countryId);

    if (!cur) {
      const { error: insErr } = await ctx.supabase.from("training_materials").insert({ ...row, organization_id: ctx.org.id, version: 1 });
      if (insErr && insErr.code !== "23505") logServerError("materials.sync_insert", insErr);
      else if (!insErr) changed++;
      continue;
    }
    const outdated = (cur.builtin_version ?? 0) < b.version;
    if (!opts.force && (!outdated || cur.is_customized || cur.deleted_at)) continue;

    const textChanged = cur.published_hash !== row.published_hash;
    // "restore" on a copy that is already the untouched standard text: nothing to do
    if (opts.force && !outdated && !textChanged && !cur.is_customized && !cur.deleted_at && cur.status === "published") continue;
    const bump = cur.status === "published" && Boolean(cur.published_hash) && textChanged;
    const { error: upErr } = await ctx.supabase.from("training_materials")
      .update({ ...row, version: bump ? cur.version + 1 : cur.version, published_at: bump || cur.status !== "published" ? new Date().toISOString() : undefined, deleted_at: null })
      .eq("id", cur.id).eq("organization_id", ctx.org.id);
    if (upErr) logServerError("materials.sync_update", upErr);
    else changed++;
  }
  return changed;
}

/** Acknowledgements the current user may see (own; all with manage_safety / view_all_employees). */
export async function loadAcks(ctx: OrgContext, materialIds: string[], opts: { all: boolean }): Promise<AckRow[]> {
  if (!materialIds.length) return [];
  if (!opts.all && !ctx.employee) return [];
  let q = ctx.supabase.from("training_material_acks").select("material_id, version, employee_id, acknowledged_at")
    .eq("organization_id", ctx.org.id).in("material_id", materialIds).limit(20000);
  if (!opts.all && ctx.employee) q = q.eq("employee_id", ctx.employee.id);
  const { data, error } = await q;
  if (error) logServerError("materials.acks", error);
  return (data ?? []) as AckRow[];
}

export async function loadAudience(ctx: OrgContext): Promise<AudienceRow[]> {
  if (!ctx.can("manage_safety")) return [];
  const { data, error } = await ctx.supabase.rpc("training_audience", { p_org: ctx.org.id });
  if (error) logServerError("materials.audience", error);
  return (data ?? []) as AudienceRow[];
}

export type Progress = { done: number; total: number };

/** Employees in the material's audience who acknowledged its CURRENT version. */
export function progressFor(m: Pick<MaterialListRow, "id" | "version" | "audience" | "country_id">, audience: AudienceRow[], acks: AckRow[]): Progress {
  const people = audience.filter((a) => inAudience(m, a));
  const acked = new Set(acks.filter((a) => a.material_id === m.id && a.version === m.version).map((a) => a.employee_id));
  return { done: people.filter((p) => acked.has(p.employee_id)).length, total: people.length };
}

/** Is the material relevant for the current user (country + roles)? Managers see everything anyway. */
export function relevantForMe(ctx: OrgContext, m: Pick<MaterialListRow, "audience" | "country_id">): boolean {
  return inAudience(m, { roles: ctx.roles, country_id: ctx.employee?.country_id ?? null });
}
