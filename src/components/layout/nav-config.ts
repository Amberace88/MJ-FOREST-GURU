import type { TKey } from "@/i18n";
import type { DashboardKind, Permission } from "@/lib/permissions";

export type NavItem = {
  key: string;
  href: string;
  label: TKey;
  /** visible when the user has ANY of these permissions (empty = everyone) */
  any?: Permission[];
  kinds?: DashboardKind[];
};

export type NavGroup = { key: string; label: TKey; items: NavItem[] };

// Exact initial navigation from the specification (§112)
export const NAV: NavGroup[] = [
  { key: "command", label: "nav.groups.command", items: [
    { key: "dashboard", href: "/dashboard", label: "nav.dashboard" },
    { key: "map", href: "/map", label: "nav.liveMap", any: ["view_gps", "view_live_gps"] },
    { key: "alerts", href: "/alerts", label: "nav.alerts", kinds: ["owner", "manager", "foreman", "mechanic"] },
  ] },
  { key: "operations", label: "nav.groups.operations", items: [
    { key: "projects", href: "/projects", label: "nav.projects" },
    { key: "hours", href: "/hours", label: "nav.hours" },
    { key: "tasks", href: "/tasks", label: "nav.tasks" },
    { key: "production", href: "/production", label: "nav.production" },
  ] },
  { key: "people", label: "nav.groups.people", items: [
    { key: "employees", href: "/employees", label: "nav.employees", any: ["view_all_employees", "view_team", "edit_employees"] },
    { key: "teams", href: "/teams", label: "nav.teams", any: ["view_all_employees", "view_team", "manage_teams"] },
    { key: "documents", href: "/documents", label: "nav.documents" },
  ] },
  { key: "fleet", label: "nav.groups.fleet", items: [
    { key: "machines", href: "/machines", label: "nav.machines" },
    { key: "fuel", href: "/fuel", label: "nav.fuel" },
    { key: "maintenance", href: "/maintenance", label: "nav.maintenance" },
  ] },
  { key: "finance", label: "nav.groups.finance", items: [
    { key: "expenses", href: "/expenses", label: "nav.expenses", any: ["create_expense", "view_finance", "approve_expense"] },
    { key: "receipts", href: "/receipts", label: "nav.receipts", any: ["create_expense", "view_finance", "approve_expense", "view_fuel"] },
    { key: "reports", href: "/reports", label: "nav.reports", any: ["export_reports"] },
  ] },
  { key: "safety", label: "nav.groups.safety", items: [
    { key: "safety", href: "/safety", label: "nav.safety" },
    { key: "incidents", href: "/incidents", label: "nav.incidents" },
    { key: "training", href: "/training", label: "nav.training" },
  ] },
  { key: "analytics", label: "nav.groups.analytics", items: [
    { key: "analytics", href: "/analytics", label: "nav.analytics", any: ["view_analytics"] },
    { key: "calculators", href: "/calculators", label: "nav.calculators" },
  ] },
  { key: "system", label: "nav.groups.system", items: [
    { key: "settings", href: "/settings", label: "nav.settings", any: ["manage_settings"] },
    { key: "users", href: "/settings/users", label: "nav.users", any: ["manage_users", "manage_permissions"] },
    { key: "integrations", href: "/settings/integrations", label: "nav.integrations", any: ["manage_integrations"] },
    { key: "audit", href: "/audit", label: "nav.audit", any: ["view_audit_log"] },
  ] },
];

export function visibleNav(perms: Set<string>, kind: DashboardKind): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.any || i.any.some((p) => perms.has(p))) && (!i.kinds || i.kinds.includes(kind))),
  })).filter((g) => g.items.length > 0);
}
