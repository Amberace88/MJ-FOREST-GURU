/**
 * Shared enums used by BOTH server pages and client components.
 * They must live in a plain module: a constant exported from a "use client" file
 * reaches server components only as a client reference (not the array itself),
 * so `.includes()` / `.map()` would crash the server render.
 */
export const EXPENSE_CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"] as const;
export const BOARD_COLUMNS = ["todo", "in_progress", "waiting", "done"] as const;
export const INCIDENT_TYPES = ["injury", "near_miss", "property_damage", "environmental", "fire", "vehicle", "other"] as const;
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const INCIDENT_STATUSES = ["open", "investigating", "action_required", "resolved", "closed"] as const;
export const SAFETY_SECTIONS = ["general", "forestry", "machinery", "chainsaw", "ppe", "emergency", "fire", "first_aid", "accident_reporting", "country_specific"] as const;
