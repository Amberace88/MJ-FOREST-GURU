import "server-only";
import { cache } from "react";
import type { OrgContext } from "@/lib/context";

/** Option lists for forms. All queries run with the user's RLS — users only see what they may use. */
export const getOptions = cache(async (ctx: OrgContext) => {
  const sb = ctx.supabase;
  const [projects, machines, employees, teams, lookups] = await Promise.all([
    sb.from("projects").select("id, code, name, status, country_id").eq("organization_id", ctx.org.id).is("deleted_at", null)
      .is("archived_at", null).order("code"),
    sb.from("machines").select("id, name, category, status, country_id, current_project_id, engine_hours, internal_code").eq("organization_id", ctx.org.id)
      .is("deleted_at", null).is("archived_at", null).order("name"),
    sb.from("employees").select("id, full_name, job_title, country_id, team_id, status, user_id").eq("organization_id", ctx.org.id)
      .is("deleted_at", null).is("archived_at", null).order("full_name"),
    sb.from("teams").select("id, name, country_id").eq("organization_id", ctx.org.id).is("archived_at", null).order("name"),
    sb.from("lookup_values").select("kind, key, label, sort_order").eq("organization_id", ctx.org.id).eq("is_active", true).order("sort_order"),
  ]);
  const lk = lookups.data ?? [];
  const byKind = (k: string) => lk.filter((l) => l.kind === k).map((l) => ({ value: l.key, label: l.label ?? l.key }));
  return {
    projects: projects.data ?? [],
    machines: machines.data ?? [],
    employees: employees.data ?? [],
    teams: teams.data ?? [],
    projectOptions: (projects.data ?? []).filter((p) => !["completed", "cancelled"].includes(p.status)).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    allProjectOptions: (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    machineOptions: (machines.data ?? []).map((m) => ({ value: m.id, label: m.name + (m.internal_code ? ` (${m.internal_code})` : "") })),
    employeeOptions: (employees.data ?? []).map((e) => ({ value: e.id, label: e.full_name ?? "" })),
    teamOptions: (teams.data ?? []).map((t) => ({ value: t.id, label: t.name ?? "" })),
    countryOptions: ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() })),
    workTypes: byKind("work_type"),
    fuelTypes: byKind("fuel_type"),
    problemCategories: byKind("problem_category"),
    documentTypes: byKind("document_type"),
  };
});

export type Options = Awaited<ReturnType<typeof getOptions>>;

/** Latvian vocative for greetings: Māris → Māri, Jānis → Jāni, Jūlija → Jūlija. */
export function vocative(firstName: string | null | undefined) {
  if (!firstName) return "";
  const n = firstName.trim();
  if (/(is|ys)$/i.test(n)) return n.slice(0, -1);
  if (/[sš]$/i.test(n) && n.length > 3) return n.slice(0, -1);
  return n;
}

export function greetingKey(tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date()));
  return hour < 11 ? "greeting.morning" : hour < 18 ? "greeting.day" : "greeting.evening";
}
