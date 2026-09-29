import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Temporary login freeze ("iesaldēt pieteikšanos"), controlled only by the platform developer.
 *
 * Enforced in three places:
 *  1. Supabase Auth ban (ban_duration) → password login and token refresh are refused by Auth itself
 *  2. app_metadata.login_frozen → middleware signs out an already open session on the next request
 *  3. login action → clear message instead of "wrong password"
 * The developer account can never be frozen, and nobody else can change the flag.
 */
const FAR_FUTURE = "876000h"; // ~100 years; lifted explicitly with "none"

export const isDeveloper = (u: Pick<User, "app_metadata"> | null | undefined) => u?.app_metadata?.platform_role === "developer";
export const isFrozen = (u: Pick<User, "app_metadata"> | null | undefined) => u?.app_metadata?.login_frozen === true && !isDeveloper(u);

export async function setLoginFrozen(userId: string, frozen: boolean, by: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return { ok: false, error: "Lietotājs nav atrasts" };
  if (isDeveloper(data.user)) return { ok: false, error: "Lapas izstrādātāja kontu nevar iesaldēt" };
  const meta = { ...(data.user.app_metadata ?? {}) } as Record<string, unknown>;
  if (frozen) Object.assign(meta, { login_frozen: true, login_frozen_at: new Date().toISOString(), login_frozen_by: by });
  else { delete meta.login_frozen; delete meta.login_frozen_at; delete meta.login_frozen_by; }
  const { error: upd } = await admin.auth.admin.updateUserById(userId, { app_metadata: meta, ban_duration: frozen ? FAR_FUTURE : "none" });
  if (upd) return { ok: false, error: "Neizdevās saglabāt" };
  return { ok: true };
}

/** Frozen flag per user id (service role; empty map when unavailable). */
export async function frozenMap(userIds: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!userIds.length) return out;
  try {
    const admin = createAdminClient();
    const res = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
    for (const r of res) if (r.data.user) out.set(r.data.user.id, isFrozen(r.data.user));
  } catch { /* display only */ }
  return out;
}
