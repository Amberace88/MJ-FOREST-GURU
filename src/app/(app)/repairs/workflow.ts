/**
 * Repair workflow (UI-side mirror of the DB rules in app.repair_before_write / repair_after_write):
 * - status changes need manage_repairs or approve_repairs (DB raises PERMISSION_DENIED otherwise)
 * - assigning a mechanic while new/acknowledged moves the repair to "assigned" (DB trigger)
 * - completing stamps completed_at and derives downtime from machine_down_since (DB trigger)
 * - every status change is written to repair_status_history (DB trigger)
 */
export const REPAIR_STATUSES = ["new", "acknowledged", "assigned", "in_progress", "waiting_parts", "external_service", "completed", "cancelled"] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const OPEN_REPAIR_STATUSES = ["new", "acknowledged", "assigned", "in_progress", "waiting_parts", "external_service"] as const;

export const REPAIR_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];

export const REPAIR_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  new: ["acknowledged", "assigned", "in_progress", "cancelled"],
  acknowledged: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "waiting_parts", "external_service", "cancelled"],
  in_progress: ["waiting_parts", "external_service", "completed", "cancelled"],
  waiting_parts: ["in_progress", "external_service", "completed", "cancelled"],
  external_service: ["in_progress", "waiting_parts", "completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["new"],
};

export function isRepairStatus(s: string | null | undefined): s is RepairStatus {
  return !!s && (REPAIR_STATUSES as readonly string[]).includes(s);
}

export function canTransition(from: string, to: string): boolean {
  return isRepairStatus(from) && isRepairStatus(to) && REPAIR_TRANSITIONS[from].includes(to);
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export function priorityRank(p: string) {
  return PRIORITY_RANK[p] ?? 9;
}

/** Heuristic for the mechanic picker: job title or a mechanic project role. */
export function looksLikeMechanic(jobTitle: string | null | undefined) {
  return !!jobTitle && /meh[aā]ni|mechanic|mekaniker|vélvirk/i.test(jobTitle);
}
