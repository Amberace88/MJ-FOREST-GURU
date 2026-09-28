import "server-only";
import { netHours, type WorkLogRow } from "@/components/shared/lists";
import type { OrgContext } from "@/lib/context";
import { todayIn, zonedMidnightUtc } from "@/lib/format";

export type LiveInfo = {
  todayHours: number;
  working: boolean;
  project: { id: string; code: string } | null;
  machine: { id: string; name: string } | null;
};

/** Signed URLs for employee photos (private media bucket; storage RLS mirrors public.files). */
export async function photoUrls(ctx: OrgContext, paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const out = new Map<string, string>();
  if (!list.length) return out;
  const { data } = await ctx.supabase.storage.from("media").createSignedUrls(list, 60 * 60);
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
  return out;
}

/**
 * Today's net hours, active shift, current project and machine for a set of employees.
 * Current project: active shift → otherwise the most recent active project assignment.
 * Current machine: active shift machine → otherwise machines.current_operator_id.
 */
export async function liveInfo(ctx: OrgContext, employeeIds: string[]): Promise<Map<string, LiveInfo>> {
  const map = new Map<string, LiveInfo>();
  for (const id of employeeIds) map.set(id, { todayHours: 0, working: false, project: null, machine: null });
  if (!employeeIds.length) return map;
  const tz = ctx.timezone;
  const midnight = zonedMidnightUtc(todayIn(tz), tz).toISOString();
  const midnightMs = new Date(midnight).getTime();

  const [logsRes, pwRes, machinesRes] = await Promise.all([
    ctx.supabase.from("work_logs")
      .select("id, employee_id, started_at, ended_at, status, work_type, source, project:projects(id, code), machine:machines(id, name), breaks:work_breaks(started_at, ended_at)")
      .eq("organization_id", ctx.org.id).in("employee_id", employeeIds).is("deleted_at", null)
      .or(`started_at.gte."${midnight}",ended_at.is.null,ended_at.gte."${midnight}"`)
      .order("started_at", { ascending: false }).limit(1000),
    ctx.supabase.from("project_workers").select("employee_id, assigned_at, project:projects(id, code)")
      .eq("organization_id", ctx.org.id).in("employee_id", employeeIds).is("unassigned_at", null)
      .order("assigned_at", { ascending: false }),
    ctx.supabase.from("machines").select("id, name, current_operator_id")
      .eq("organization_id", ctx.org.id).in("current_operator_id", employeeIds).is("deleted_at", null).is("archived_at", null),
  ]);

  type LogRow = WorkLogRow & { employee_id: string };
  for (const l of (logsRes.data ?? []) as unknown as LogRow[]) {
    const info = map.get(l.employee_id);
    if (!info) continue;
    // Count only the portion after local midnight for shifts crossing midnight.
    const before = (iso: string) => new Date(iso).getTime() < midnightMs;
    const clipped: WorkLogRow = before(l.started_at) ? {
      ...l, started_at: midnight,
      breaks: (l.breaks ?? []).filter((b) => !b.ended_at || !before(b.ended_at)).map((b) => ({ ...b, started_at: before(b.started_at) ? midnight : b.started_at })),
    } : l;
    info.todayHours += netHours(clipped);
    if (!l.ended_at) {
      info.working = true;
      if (l.project) info.project = l.project;
      if (l.machine) info.machine = l.machine;
    }
  }
  for (const pw of pwRes.data ?? []) {
    const info = map.get(pw.employee_id);
    const project = pw.project as { id: string; code: string } | null;
    if (info && !info.project && project) info.project = project;
  }
  for (const m of machinesRes.data ?? []) {
    const info = m.current_operator_id ? map.get(m.current_operator_id) : undefined;
    if (info && !info.machine) info.machine = { id: m.id, name: m.name };
  }
  return map;
}
