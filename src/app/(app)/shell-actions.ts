"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COUNTRY_COOKIE, ORG_COOKIE, requireOrg } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function setCountryFilter(countryId: string | null) {
  const ctx = await requireOrg();
  const store = await cookies();
  if (countryId && ctx.countries.some((c) => c.id === countryId)) store.set(COUNTRY_COOKIE, countryId, cookieOpts);
  else store.delete(COUNTRY_COOKIE);
}

export async function setOrganization(orgId: string) {
  const ctx = await requireOrg();
  if (!ctx.orgs.some((o) => o.id === orgId)) return;
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, cookieOpts);
  store.delete(COUNTRY_COOKIE);
}

export type SearchHit = { entity_type: string; entity_id: string; title: string; subtitle: string; link: string };

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2 || q.length > 80) return [];
  const ctx = await requireOrg();
  // SECURITY INVOKER RPC: results are filtered by the caller's RLS
  const { data } = await ctx.supabase.rpc("global_search", { p_org: ctx.org.id, p_query: q });
  return (data ?? []) as SearchHit[];
}

export async function getNotifications() {
  const ctx = await requireOrg();
  const { data } = await ctx.supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function markNotificationsRead(ids?: string[]) {
  const ctx = await requireOrg();
  let q = ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", ctx.user.id);
  if (ids?.length) q = q.in("id", ids);
  await q;
}

export async function logout() {
  const supabase = await createClient();
  try {
    await supabase.rpc("log_auth_event", { p_action: "logout" });
  } catch {
    /* best effort */
  }
  await supabase.auth.signOut();
  redirect("/login");
}
