/**
 * Machine service health (pure, no I/O) — shared by /machines, /machines/[id] and /maintenance.
 *
 * next service  = machines.next_service_hours, else last_service_hours + service_interval_hours
 * remaining     = next service − engine_hours
 * warning       = organization_settings.service_warning_hours (default 50)
 *
 * critical : machine broken, an open critical repair, or far beyond the service point
 * overdue  : past the service engine hours or the service date
 * soon     : within the warning window (hours) or within 14 days of the service date
 * healthy  : service data present and nothing due
 * unknown  : no service data recorded yet (never guessed)
 */
export type Health = "healthy" | "soon" | "overdue" | "critical" | "unknown";
export const HEALTH_ORDER: Health[] = ["critical", "overdue", "soon", "healthy", "unknown"];

export type HealthInput = {
  status: string;
  engine_hours: number | null;
  last_service_hours: number | null;
  service_interval_hours: number | null;
  next_service_hours: number | null;
  next_service_at: string | null;
};

export type HealthResult = {
  health: Health;
  nextHours: number | null;
  remaining: number | null;
  daysLeft: number | null;
  /** 0–100+ share of the service interval already used */
  progress: number | null;
};

const DAY = 86_400_000;

export function machineHealth(m: HealthInput, opts: { warningHours?: number | null; openCritical?: boolean; today: string }): HealthResult {
  const warning = opts.warningHours ?? 50;
  const eh = m.engine_hours != null ? Number(m.engine_hours) : null;
  const interval = m.service_interval_hours != null ? Number(m.service_interval_hours) : null;
  const last = m.last_service_hours != null ? Number(m.last_service_hours) : null;
  const nextHours = m.next_service_hours != null ? Number(m.next_service_hours) : last != null && interval ? last + interval : null;
  const remaining = nextHours != null && eh != null ? Math.round((nextHours - eh) * 10) / 10 : null;
  const daysLeft = m.next_service_at
    ? Math.round((new Date(`${m.next_service_at}T12:00:00Z`).getTime() - new Date(`${opts.today}T12:00:00Z`).getTime()) / DAY)
    : null;

  let progress: number | null = null;
  if (interval && eh != null) {
    if (last != null) progress = ((eh - last) / interval) * 100;
    else if (remaining != null) progress = ((interval - remaining) / interval) * 100;
  }
  if (progress != null) progress = Math.max(0, progress);

  const farBeyond = remaining != null && remaining < -Math.max(warning, (interval ?? 0) * 0.1);
  let health: Health;
  if (m.status === "broken" || opts.openCritical || farBeyond || (daysLeft != null && daysLeft < -30)) health = "critical";
  else if ((remaining != null && remaining < 0) || (daysLeft != null && daysLeft < 0)) health = "overdue";
  else if ((remaining != null && remaining <= warning) || (daysLeft != null && daysLeft <= 14)) health = "soon";
  else if (remaining != null || daysLeft != null) health = "healthy";
  else health = "unknown";

  return { health, nextHours, remaining, daysLeft, progress };
}

export function healthTone(h: Health): "ok" | "warn" | "amber" | "crit" | "off" {
  return h === "healthy" ? "ok" : h === "soon" ? "warn" : h === "overdue" ? "amber" : h === "critical" ? "crit" : "off";
}

export function progressTone(h: Health): "forest" | "warn" | "amber" | "crit" {
  return h === "critical" ? "crit" : h === "overdue" ? "amber" : h === "soon" ? "warn" : "forest";
}
