export const PERMISSIONS = [
  "view_dashboard", "view_all_employees", "edit_employees", "view_team", "manage_teams", "view_salaries",
  "view_employee_hours", "edit_employee_hours", "approve_hours", "view_finance", "create_expense", "approve_expense",
  "view_fuel", "edit_fuel", "view_gps", "view_live_gps", "view_gps_history", "view_all_projects", "manage_projects",
  "manage_tasks", "view_all_machines", "manage_machines", "manage_repairs", "approve_repairs", "manage_documents",
  "manage_safety", "manage_incidents", "manage_users", "manage_permissions", "manage_settings", "view_audit_log",
  "view_analytics", "export_reports", "manage_integrations",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ["owner", "admin", "manager", "foreman", "mechanic", "employee"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const INVITABLE_ROLES: RoleKey[] = ["employee", "foreman", "manager", "mechanic", "admin"];

export const PERMISSION_GROUPS: { key: string; perms: Permission[] }[] = [
  { key: "general", perms: ["view_dashboard", "view_analytics", "export_reports"] },
  { key: "people", perms: ["view_all_employees", "edit_employees", "view_team", "manage_teams", "view_salaries"] },
  { key: "hours", perms: ["view_employee_hours", "edit_employee_hours", "approve_hours"] },
  { key: "operations", perms: ["view_all_projects", "manage_projects", "manage_tasks"] },
  { key: "fleet", perms: ["view_all_machines", "manage_machines", "manage_repairs", "approve_repairs", "view_fuel", "edit_fuel"] },
  { key: "gps", perms: ["view_gps", "view_live_gps", "view_gps_history"] },
  { key: "finance", perms: ["view_finance", "create_expense", "approve_expense"] },
  { key: "safety", perms: ["manage_safety", "manage_incidents", "manage_documents"] },
  { key: "system", perms: ["manage_users", "manage_permissions", "manage_settings", "view_audit_log", "manage_integrations"] },
];

/**
 * UI-level permission check (show/hide). The database independently enforces
 * every permission with RLS and triggers — hiding a button is never security.
 */
export function can(perms: readonly string[] | Set<string>, ...required: Permission[]) {
  const set = perms instanceof Set ? perms : new Set(perms);
  return required.every((p) => set.has(p));
}
export function canAny(perms: readonly string[] | Set<string>, ...any: Permission[]) {
  const set = perms instanceof Set ? perms : new Set(perms);
  return any.some((p) => set.has(p));
}

export type DashboardKind = "owner" | "manager" | "foreman" | "mechanic" | "employee";

export function dashboardKind(roles: readonly string[]): DashboardKind {
  if (roles.includes("owner") || roles.includes("admin")) return "owner";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("foreman")) return "foreman";
  if (roles.includes("mechanic")) return "mechanic";
  return "employee";
}
