import type { Permission } from "@/lib/permissions";

export const REPORT_TYPES = ["hours", "fuel", "expenses", "machines", "maintenance", "projects", "production", "safety", "incidents"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export type ExportFormat = "csv" | "excel";

/** Besides `export_reports`, the user needs ANY of these for the data domain (RLS still filters every row). */
export const REPORT_PERMS: Record<ReportType, Permission[]> = {
  hours: ["view_employee_hours", "approve_hours", "edit_employee_hours", "view_all_employees"],
  fuel: ["view_fuel", "edit_fuel", "view_finance"],
  expenses: ["view_finance", "approve_expense"],
  machines: ["view_all_machines", "manage_machines"],
  maintenance: ["manage_repairs", "approve_repairs", "view_all_machines", "manage_machines"],
  projects: ["view_all_projects", "manage_projects"],
  production: ["view_all_projects", "manage_projects"],
  safety: ["manage_safety"],
  incidents: ["manage_incidents", "manage_safety"],
};

/** Reports that describe current state rather than a period. */
export const PERIODLESS: ReportType[] = ["safety"];

export function isReportType(v: string): v is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(v);
}

export function exportHref(type: ReportType, p: { from: string; to: string; country?: string | null; format: ExportFormat }) {
  const u = new URLSearchParams({ from: p.from, to: p.to, format: p.format });
  if (p.country) u.set("country", p.country);
  return `/api/export/${type}?${u}`;
}
