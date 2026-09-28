import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Tone = "ok" | "warn" | "crit" | "off" | "info" | "neutral" | "forest" | "amber" | "wood";

/** Maps domain statuses to visual tones (UI only). */
export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case "active": case "approved": case "completed": case "done": case "paid": case "connected": case "resolved": case "healthy": case "ok":
      return "ok";
    case "submitted": case "in_progress": case "investigating": case "assigned": case "acknowledged": case "planned": case "idle":
    case "waiting": case "waiting_parts": case "external_service": case "on_leave": case "delayed": case "soon": case "corrected": case "invited":
      return "warn";
    case "rejected": case "broken": case "critical": case "error": case "action_required": case "overdue": case "cancelled_red":
      return "crit";
    case "maintenance": case "correction_requested": case "open": case "new": case "todo":
      return "info";
    case "inactive": case "offline": case "cancelled": case "closed": case "draft": case "archived": case "not_configured": case "disabled": case "paused":
      return "off";
    default:
      return "neutral";
  }
}

export function priorityTone(p: string | null | undefined): Tone {
  return p === "critical" ? "crit" : p === "high" ? "amber" : p === "medium" ? "info" : "off";
}

export function severityTone(s: string | null | undefined): Tone {
  return s === "critical" || s === "high" ? "crit" : s === "warning" || s === "medium" ? "warn" : "info";
}

export function searchParamsToString(sp: Record<string, string | string[] | undefined>, patch: Record<string, string | null | undefined> = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) u.set(k, v);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") u.delete(k);
    else u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

/** Sanitized ILIKE pattern for PostgREST `.or()` filters (prevents filter injection). */
export function likeTerm(q: string | undefined | null) {
  const clean = (q ?? "").replace(/[%,()*\\:"'.]/g, " ").trim().slice(0, 60);
  return clean ? `%${clean}%` : null;
}
