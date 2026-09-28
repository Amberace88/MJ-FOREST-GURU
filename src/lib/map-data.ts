import "server-only";
import type { OrgContext } from "@/lib/context";
import { fmtDateTime, fmtNumber } from "@/lib/format";

export type MapMarker = {
  id: string;
  kind: "machine" | "project" | "employee";
  lat: number;
  lng: number;
  status: "active" | "attention" | "critical" | "offline";
  title: string;
  subtitle?: string;
  lines: [string, string][];
  lastUpdate?: string | null;
  stale?: boolean;
  href: string;
};

const STALE_MS = 60 * 60 * 1000; // positions older than 1h are never shown as live

/** Builds map markers strictly from database records visible to the user (RLS). No invented positions. */
export async function getMapData(ctx: OrgContext, opts: { countryId?: string | null; projectId?: string } = {}) {
  const sb = ctx.supabase;
  const canGps = ctx.canAny("view_gps", "view_live_gps", "view_gps_history");
  const tz = ctx.timezone;
  const country = opts.countryId ?? ctx.countryId;

  let mq = sb.from("machines").select("id, name, category, status, engine_hours, country_id, current_project_id, next_service_hours, current_operator:employees!machines_current_operator_id_fkey(full_name), project:projects!machines_current_project_id_fkey(code, name, latitude, longitude)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null);
  if (country) mq = mq.eq("country_id", country);
  if (opts.projectId) mq = mq.eq("current_project_id", opts.projectId);

  let pq = sb.from("projects").select("id, code, name, status, latitude, longitude, client_name, country_id")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).in("status", ["active", "planned", "paused"]);
  if (country) pq = pq.eq("country_id", country);
  if (opts.projectId) pq = pq.eq("id", opts.projectId);

  const [machinesRes, projectsRes, positionsRes, repairsRes, activeLogsRes, maponRes] = await Promise.all([
    mq,
    pq,
    canGps ? sb.from("machine_latest_positions").select("machine_id, recorded_at, latitude, longitude, speed_kmh, ignition, engine_hours, source").eq("organization_id", ctx.org.id) : Promise.resolve({ data: [] as never[] }),
    sb.from("repair_requests").select("machine_id, priority").eq("organization_id", ctx.org.id).is("deleted_at", null).not("status", "in", "(completed,cancelled)"),
    sb.from("work_logs").select("id, machine_id, employee_id, started_at, start_lat, start_lng, employee:employees(full_name), project:projects(code)").eq("organization_id", ctx.org.id).is("ended_at", null).is("deleted_at", null),
    ctx.can("manage_integrations") || canGps ? sb.from("integration_settings").select("status, last_success_at, enabled").eq("organization_id", ctx.org.id).eq("provider", "mapon").maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const positions = new Map((positionsRes.data ?? []).map((p) => [p.machine_id as string, p]));
  const repairs = new Map<string, string>();
  for (const r of repairsRes.data ?? []) {
    const prev = repairs.get(r.machine_id);
    if (!prev || r.priority === "critical") repairs.set(r.machine_id, r.priority);
  }
  const activeByMachine = new Map((activeLogsRes.data ?? []).filter((l) => l.machine_id).map((l) => [l.machine_id as string, l]));

  const markers: MapMarker[] = [];
  for (const m of machinesRes.data ?? []) {
    const pos = positions.get(m.id);
    if (!pos || pos.latitude == null || pos.longitude == null) continue; // no GPS → not on map (never invented)
    const age = Date.now() - new Date(pos.recorded_at as string).getTime();
    const stale = age > STALE_MS;
    const log = activeByMachine.get(m.id);
    const rep = repairs.get(m.id);
    const serviceDue = m.next_service_hours != null && m.engine_hours != null && Number(m.next_service_hours) - Number(m.engine_hours) <= 50;
    const status: MapMarker["status"] =
      rep === "critical" || m.status === "broken" ? "critical"
      : stale ? "offline"
      : rep || serviceDue || m.status === "maintenance" ? "attention"
      : log || pos.ignition ? "active" : "offline";
    const op = (m.current_operator as { full_name: string } | null)?.full_name ?? (log?.employee as { full_name: string } | null)?.full_name;
    const proj = m.project as { code: string } | null;
    markers.push({
      id: m.id, kind: "machine", lat: Number(pos.latitude), lng: Number(pos.longitude), status, title: m.name,
      subtitle: ctx.label("machines.categories", m.category),
      lines: [
        [ctx.t("map.operator"), op ?? "—"],
        [ctx.t("common.project"), proj?.code ?? "—"],
        [ctx.t("common.status"), log ? ctx.t("map.working") : ctx.label("machines.status", m.status)],
        [ctx.t("map.engineHours"), m.engine_hours != null ? `${fmtNumber(m.engine_hours)} h` : "—"],
        [ctx.t("map.gps"), pos.source === "mapon_gps" || pos.source === "mapon_can" ? "Mapon" : pos.source === "manual" ? "Manuāli" : String(pos.source)],
      ],
      lastUpdate: fmtDateTime(pos.recorded_at as string, tz), stale, href: `/machines/${m.id}`,
    });
  }

  for (const p of projectsRes.data ?? []) {
    if (p.latitude == null || p.longitude == null) continue;
    markers.push({
      id: p.id, kind: "project", lat: p.latitude, lng: p.longitude, status: p.status === "active" ? "active" : "offline",
      title: `${p.code} · ${p.name}`, subtitle: ctx.label("projects.status", p.status),
      lines: [[ctx.t("projects.client"), p.client_name ?? "—"]], href: `/projects/${p.id}`,
    });
  }

  if (canGps) {
    for (const l of activeLogsRes.data ?? []) {
      if (l.start_lat == null || l.start_lng == null) continue;
      const e = l.employee as { full_name: string } | null;
      markers.push({
        id: `emp-${l.id}`, kind: "employee", lat: l.start_lat, lng: l.start_lng, status: "active", title: e?.full_name ?? "—",
        subtitle: (l.project as { code: string } | null)?.code ?? undefined,
        lines: [[ctx.t("work.started"), fmtDateTime(l.started_at, tz)]], lastUpdate: fmtDateTime(l.started_at, tz),
        href: `/employees/${l.employee_id}`,
      });
    }
  }

  const mapon = maponRes.data as { status: string; last_success_at: string | null; enabled: boolean } | null;
  return {
    markers,
    canGps,
    maponState: mapon?.enabled ? mapon.status : "not_configured",
    maponLastSuccess: mapon?.last_success_at ? fmtDateTime(mapon.last_success_at, tz) : null,
    machinesWithoutGps: (machinesRes.data ?? []).filter((m) => !positions.has(m.id)).length,
  };
}
