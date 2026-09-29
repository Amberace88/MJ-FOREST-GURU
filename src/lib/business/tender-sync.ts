import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { iubDayUrl, parseIubDay, type TenderNoticeRow } from "./iub";
import { fetchTenders } from "./ted";
import { classifyTender } from "./tender-classify";

/**
 * Keeps public.tender_notices fresh: IUB (all Latvian notices, day files) + TED (LV/SE/IS).
 * Runs lazily from the business page when the cache is older than STALE_MS, from the
 * "Atjaunot" button, and from /api/cron/tenders. Progress is saved per day, so a run cut
 * short by a serverless timeout simply continues next time.
 */
const STALE_MS = 6 * 60 * 60 * 1000;
const FIRST_RUN_DAYS = 30;
const MAX_DAYS_PER_RUN = 20;
const BATCH = 5;

const rigaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga" }).format(new Date());
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

type Admin = ReturnType<typeof createAdminClient>;
export type SyncResult = { ok: boolean; skipped?: boolean; added: number; days: number; error?: string };

async function fetchDay(day: string): Promise<TenderNoticeRow[] | "missing"> {
  const res = await fetch(iubDayUrl(day), { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return "missing";
  if (!res.ok) throw new Error(`IUB ${day}: ${res.status}`);
  return parseIubDay(await res.json(), day);
}

async function upsert(admin: Admin, rows: TenderNoticeRow[]): Promise<string[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: existing } = await admin.from("tender_notices").select("id").in("id", ids);
  const known = new Set((existing ?? []).map((r) => r.id));
  const { error } = await admin.from("tender_notices").upsert(rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "id" });
  if (error) throw new Error(`upsert: ${error.message}`);
  return ids.filter((id) => !known.has(id));
}

async function syncIub(admin: Admin): Promise<{ added: string[]; days: number }> {
  const { data: state } = await admin.from("tender_sync_state").select("last_day").eq("source", "iub").maybeSingle();
  const today = rigaToday();
  let day = state?.last_day ? addDays(state.last_day, 1) : addDays(today, -FIRST_RUN_DAYS);
  const added: string[] = [];
  let days = 0;
  while (day <= today && days < MAX_DAYS_PER_RUN) {
    const batch: string[] = [];
    for (let d = day; d <= today && batch.length < BATCH && days + batch.length < MAX_DAYS_PER_RUN; d = addDays(d, 1)) batch.push(d);
    const results = await Promise.all(batch.map((d) => fetchDay(d).catch((e) => { logServerError("tenders.iub_day", e); return "error" as const; })));
    let lastDone: string | null = null;
    for (let i = 0; i < batch.length; i++) {
      const r = results[i];
      // today's / yesterday's file may not exist yet → stop there and retry next run
      if (r === "error" || (r === "missing" && batch[i] >= addDays(today, -1))) break;
      if (r !== "missing") added.push(...(await upsert(admin, r)));
      lastDone = batch[i];
    }
    if (!lastDone) break;
    await admin.from("tender_sync_state").upsert({ source: "iub", last_day: lastDone, last_run_at: new Date().toISOString(), last_error: null });
    days += batch.indexOf(lastDone) + 1;
    if (lastDone !== batch.at(-1)) break;
    day = addDays(lastDone, 1);
  }
  return { added, days };
}

async function syncTed(admin: Admin): Promise<string[]> {
  const { items, error } = await fetchTenders({ countries: ["LV", "SE", "IS"], sinceDays: 120, limit: 200 });
  if (error) throw new Error(error);
  const rows: TenderNoticeRow[] = items.map((t) => {
    const c = classifyTender({ title: t.title });
    return {
      id: `ted:${t.id}`, source: "ted", country: t.countries[0] ?? "LV",
      stage: t.kind === "award" ? "result" : t.kind === "prior" ? "planning" : t.kind === "notice" ? "competition" : "other",
      notice_type: t.kind, title: t.title.slice(0, 500), description: null, buyer_name: t.buyer, buyer_reg_no: null, buyer_city: null,
      buyer_email: null, buyer_phone: null, region: null, cpv: null, cpv_extra: [],
      category: c.category === "other" ? "harvesting" : c.category, score: Math.max(6, c.score), nature: "services", procedure: null, reference: t.id,
      published_on: t.published || null, deadline: t.deadline ? `${t.deadline}T21:59:00Z` : null, duration_months: null,
      estimated_value: t.value, currency: t.currency, url: t.url,
    };
  });
  const added = await upsert(admin, rows);
  await admin.from("tender_sync_state").upsert({ source: "ted", last_day: rigaToday(), last_run_at: new Date().toISOString(), last_error: null });
  return added;
}

/** One summary notification per organisation for new open notices in its countries. */
async function notify(admin: Admin, newIds: string[]) {
  if (!newIds.length) return;
  const { data: rows } = await admin.from("tender_notices").select("id, country, stage, title, deadline").in("id", newIds.slice(0, 500));
  const now = new Date().toISOString();
  const open = (rows ?? []).filter((r) => r.stage !== "result" && (!r.deadline || r.deadline > now));
  if (!open.length) return;
  const { data: orgs } = await admin.from("organizations").select("id, is_demo, countries(code, is_active)").eq("is_demo", false);
  for (const org of orgs ?? []) {
    const codes = new Set(((org.countries ?? []) as { code: string; is_active: boolean }[]).filter((c) => c.is_active).map((c) => c.code));
    const mine = open.filter((r) => codes.size === 0 || codes.has(r.country));
    if (!mine.length) continue;
    const { data: perms } = await admin.from("role_permissions").select("role_id").eq("organization_id", org.id).eq("permission_key", "manage_projects");
    const roleIds = (perms ?? []).map((p) => p.role_id);
    if (!roleIds.length) continue;
    const { data: ur } = await admin.from("user_roles").select("user_id").eq("organization_id", org.id).in("role_id", roleIds);
    const { data: active } = await admin.from("organization_members").select("user_id").eq("organization_id", org.id).eq("status", "active");
    const activeSet = new Set((active ?? []).map((m) => m.user_id));
    const users = [...new Set((ur ?? []).map((u) => u.user_id))].filter((u) => activeSet.has(u));
    if (!users.length) continue;
    const title = mine.length === 1 ? `Jauns meža iepirkums: ${mine[0].title.slice(0, 120)}` : `${mine.length} jauni meža darbu iepirkumi`;
    const body = mine.slice(0, 5).map((r) => `• ${r.title.slice(0, 100)}`).join("\n");
    await admin.from("notifications").insert(users.map((user_id) => ({
      organization_id: org.id, user_id, type: "tender_new", title, body, link: "/business?tab=tenders&new=1",
    })));
  }
}

/**
 * Contract reminders (piggy-backs on the sync run): end / notice dates and open milestones
 * due within 7 days → one notification per item and user, at most once every 3 days.
 */
async function notifyContractDeadlines(admin: Admin) {
  const today = rigaToday();
  const horizon = addDays(today, 7);
  const [{ data: contracts }, { data: milestones }] = await Promise.all([
    admin.from("contracts").select("id, organization_id, title, end_date, notice_date, responsible_user, created_by")
      .is("deleted_at", null).in("status", ["signed", "active"])
      .or(`and(end_date.gte.${today},end_date.lte.${horizon}),and(notice_date.gte.${today},notice_date.lte.${horizon})`),
    admin.from("contract_milestones").select("id, organization_id, contract_id, title, kind, due_date, contract:contracts!inner(title, status, deleted_at, responsible_user, created_by)")
      .is("deleted_at", null).is("done_at", null).lte("due_date", horizon).gte("due_date", addDays(today, -1)),
  ]);
  type Item = { org: string; entity: string; user: string | null; title: string; body: string; link: string };
  const items: Item[] = [];
  for (const c of contracts ?? []) {
    const user = c.responsible_user ?? c.created_by;
    if (c.notice_date && c.notice_date >= today && c.notice_date <= horizon)
      items.push({ org: c.organization_id, entity: c.id, user, title: `Līgums: jāizlemj par pagarināšanu līdz ${c.notice_date.split("-").reverse().join(".")}`, body: c.title, link: `/contracts/${c.id}` });
    if (c.end_date && c.end_date >= today && c.end_date <= horizon)
      items.push({ org: c.organization_id, entity: c.id, user, title: `Līgums beidzas ${c.end_date.split("-").reverse().join(".")}`, body: c.title, link: `/contracts/${c.id}` });
  }
  for (const m of milestones ?? []) {
    const k = m.contract as unknown as { title: string; status: string; deleted_at: string | null; responsible_user: string | null; created_by: string | null } | null;
    if (!k || k.deleted_at || !["signed", "active", "negotiation"].includes(k.status) || !m.due_date) continue;
    items.push({ org: m.organization_id, entity: m.id, user: k.responsible_user ?? k.created_by, title: `${m.title} — ${m.due_date.split("-").reverse().join(".")}`, body: k.title, link: `/contracts/${m.contract_id}` });
  }
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  for (const it of items) {
    if (!it.user) continue;
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", it.user).eq("type", "contract_due").eq("entity_id", it.entity).gte("created_at", since);
    if (count) continue;
    await admin.from("notifications").insert({ organization_id: it.org, user_id: it.user, type: "contract_due", title: it.title.slice(0, 200), body: it.body, link: it.link, entity_type: "contract", entity_id: it.entity });
  }
}

export async function syncTendersIfStale(opts: { force?: boolean } = {}): Promise<SyncResult> {
  if (!hasServiceRole()) return { ok: false, added: 0, days: 0, error: "no-service-role" };
  const admin = createAdminClient();
  try {
    if (!opts.force) {
      const { data } = await admin.from("tender_sync_state").select("last_run_at, last_day").eq("source", "iub").maybeSingle();
      const age = data?.last_run_at ? Date.now() - Date.parse(data.last_run_at) : Infinity;
      // still catching up on older days → continue soon (but never two runs at once)
      const behind = !data?.last_day || data.last_day < addDays(rigaToday(), -2);
      if (age < (behind ? 45_000 : STALE_MS)) return { ok: true, skipped: true, added: 0, days: 0 };
    }
    // mark the run first so parallel page loads do not all start a sync
    const { data: prev } = await admin.from("tender_sync_state").select("last_day").eq("source", "iub").maybeSingle();
    await admin.from("tender_sync_state").upsert({ source: "iub", last_day: prev?.last_day ?? null, last_run_at: new Date().toISOString() });
    const [iub, ted] = await Promise.all([
      syncIub(admin).catch((e) => { logServerError("tenders.iub", e); return { added: [] as string[], days: 0 }; }),
      syncTed(admin).catch((e) => { logServerError("tenders.ted", e); return [] as string[]; }),
    ]);
    const added = [...iub.added, ...ted];
    // the very first fill is history, not news
    if (prev?.last_day) await notify(admin, added).catch((e) => logServerError("tenders.notify", e));
    await notifyContractDeadlines(admin).catch((e) => logServerError("contracts.notify", e));
    return { ok: true, added: added.length, days: iub.days };
  } catch (e) {
    logServerError("tenders.sync", e);
    await admin.from("tender_sync_state").upsert({ source: "iub", last_error: String(e).slice(0, 500) }).then(() => undefined, () => undefined);
    return { ok: false, added: 0, days: 0, error: "sync failed" };
  }
}
