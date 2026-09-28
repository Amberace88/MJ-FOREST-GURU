import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import type { Translator } from "@/i18n";
import { fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtNumber, fmtTime, hoursBetween } from "@/lib/format";
import { priorityTone, statusTone } from "@/lib/utils";

type Rel<T> = T | null;

/* ------------------------------------------------------------------ work logs */
export type WorkLogRow = {
  id: string; started_at: string; ended_at: string | null; status: string; work_type: string | null; source: string;
  employee?: Rel<{ id: string; full_name: string }>; project?: Rel<{ id: string; code: string }>; machine?: Rel<{ id: string; name: string }>;
  breaks?: { started_at: string; ended_at: string | null }[];
};

export function netHours(l: WorkLogRow) {
  const gross = hoursBetween(l.started_at, l.ended_at);
  const brk = (l.breaks ?? []).reduce((a, b) => a + hoursBetween(b.started_at, b.ended_at), 0);
  return Math.max(0, gross - brk);
}

export function WorkLogTable({ rows, tr, tz, showEmployee = true, actions }: { rows: WorkLogRow[]; tr: Translator; tz: string; showEmployee?: boolean; actions?: (r: WorkLogRow) => React.ReactNode }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id}
      empty={<EmptyState title={tr.t("hours.empty")} />}
      columns={[
        ...(showEmployee ? [{ key: "emp", header: tr.t("common.employee"), cell: (r: WorkLogRow) => r.employee ? <Link href={`/employees/${r.employee.id}`} className="hover:text-amber">{r.employee.full_name}</Link> : "—" }] : []),
        { key: "date", header: tr.t("common.date"), cell: (r) => fmtDate(r.started_at, tz) },
        { key: "time", header: tr.t("common.time"), cell: (r) => `${fmtTime(r.started_at, tz)} – ${r.ended_at ? fmtTime(r.ended_at, tz) : "…"}` },
        { key: "proj", header: tr.t("common.project"), cell: (r) => r.project ? <Link href={`/projects/${r.project.id}`} className="hover:text-amber">{r.project.code}</Link> : "—", hideOnMobile: true },
        { key: "mach", header: tr.t("common.machine"), cell: (r) => r.machine?.name ?? "—", hideOnMobile: true },
        { key: "net", header: tr.t("hours.net"), cell: (r) => <span className="tabular">{fmtHours(netHours(r))}</span>, align: "right" },
        { key: "st", header: tr.t("common.status"), cell: (r) => <Badge tone={r.status === "active" ? "ok" : statusTone(r.status)} dot pulse={r.status === "active"}>{tr.label("hours.status", r.status)}</Badge> },
        ...(actions ? [{ key: "act", header: "", cell: actions, align: "right" as const }] : []),
      ]} />
  );
}

/* ------------------------------------------------------------------ fuel */
export type FuelRow = {
  id: string; occurred_at: string; litres: number; total_amount: number | null; currency: string; engine_hours: number | null; fuel_type: string; location_text: string | null;
  employee?: Rel<{ id: string; full_name: string }>; machine?: Rel<{ id: string; name: string }>; project?: Rel<{ id: string; code: string }>; source?: string;
};
export function FuelTable({ rows, tr, tz }: { rows: FuelRow[]; tr: Translator; tz: string }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState title={tr.t("fuel.empty")} />}
      columns={[
        { key: "d", header: tr.t("common.date"), cell: (r) => fmtDateTime(r.occurred_at, tz) },
        { key: "m", header: tr.t("common.machine"), cell: (r) => r.machine ? <Link href={`/machines/${r.machine.id}`} className="hover:text-amber">{r.machine.name}</Link> : "—" },
        { key: "l", header: tr.t("fuel.litres"), cell: (r) => `${fmtNumber(r.litres, 1)} L`, align: "right" },
        { key: "a", header: tr.t("fuel.totalAmount"), cell: (r) => fmtMoney(r.total_amount, r.currency), align: "right" },
        { key: "eh", header: tr.t("fuel.engineHours"), cell: (r) => r.engine_hours != null ? `${fmtNumber(r.engine_hours, 1)} h` : "—", align: "right", hideOnMobile: true },
        { key: "e", header: tr.t("common.employee"), cell: (r) => r.employee?.full_name ?? "—", hideOnMobile: true },
        { key: "p", header: tr.t("common.project"), cell: (r) => r.project?.code ?? "—", hideOnMobile: true },
        { key: "loc", header: tr.t("fuel.station"), cell: (r) => r.location_text ?? "—", hideOnMobile: true },
      ]} />
  );
}

/* ------------------------------------------------------------------ expenses */
export type ExpenseRow = {
  id: string; expense_date: string; amount: number; currency: string; category: string; status: string; description: string | null;
  employee?: Rel<{ id: string; full_name: string }>; project?: Rel<{ id: string; code: string }>; receipt_id?: string | null;
};
export function ExpenseTable({ rows, tr }: { rows: ExpenseRow[]; tr: Translator }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => `/expenses/${r.id}`} empty={<EmptyState title={tr.t("expenses.empty")} />}
      columns={[
        { key: "d", header: tr.t("common.date"), cell: (r) => fmtDate(r.expense_date) },
        { key: "c", header: tr.t("common.category"), cell: (r) => tr.label("expenses.categories", r.category) },
        { key: "desc", header: tr.t("common.description"), cell: (r) => <span className="line-clamp-1 max-w-[260px]">{r.description ?? "—"}</span>, hideOnMobile: true },
        { key: "e", header: tr.t("common.employee"), cell: (r) => r.employee?.full_name ?? "—", hideOnMobile: true },
        { key: "p", header: tr.t("common.project"), cell: (r) => r.project?.code ?? "—", hideOnMobile: true },
        { key: "a", header: tr.t("common.amount"), cell: (r) => <span className="font-medium">{fmtMoney(r.amount, r.currency)}</span>, align: "right" },
        { key: "s", header: tr.t("common.status"), cell: (r) => <Badge tone={statusTone(r.status)}>{tr.label("expenses.status", r.status)}</Badge> },
      ]} />
  );
}

/* ------------------------------------------------------------------ repairs */
export type RepairRow = {
  id: string; title: string; priority: string; status: string; created_at: string; category: string;
  machine?: Rel<{ id: string; name: string }>; project?: Rel<{ code: string }>; mechanic?: Rel<{ full_name: string }>;
};
export function RepairTable({ rows, tr, tz }: { rows: RepairRow[]; tr: Translator; tz: string }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => `/repairs/${r.id}`} empty={<EmptyState title={tr.t("repairs.empty")} />}
      columns={[
        { key: "t", header: tr.t("repairs.titleLabel"), cell: (r) => r.title },
        { key: "m", header: tr.t("common.machine"), cell: (r) => r.machine?.name ?? "—" },
        { key: "p", header: tr.t("common.priority"), cell: (r) => <Badge tone={priorityTone(r.priority)} dot pulse={r.priority === "critical" && r.status !== "completed"}>{tr.label("repairs.priority", r.priority)}</Badge> },
        { key: "s", header: tr.t("common.status"), cell: (r) => <Badge tone={statusTone(r.status)}>{tr.label("repairs.status", r.status)}</Badge> },
        { key: "mech", header: tr.t("repairs.mechanic"), cell: (r) => r.mechanic?.full_name ?? "—", hideOnMobile: true },
        { key: "d", header: tr.t("common.createdAt"), cell: (r) => fmtDate(r.created_at, tz), hideOnMobile: true },
      ]} />
  );
}

/* ------------------------------------------------------------------ tasks */
export type TaskRow = { id: string; title: string; status: string; priority: string; deadline: string | null; assignee?: Rel<{ full_name: string }>; project?: Rel<{ code: string }> };
export function TaskTable({ rows, tr, tz }: { rows: TaskRow[]; tr: Translator; tz: string }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => `/tasks?task=${r.id}`} empty={<EmptyState title={tr.t("tasks.empty")} />}
      columns={[
        { key: "t", header: tr.t("common.name"), cell: (r) => r.title },
        { key: "a", header: tr.t("tasks.assignee"), cell: (r) => r.assignee?.full_name ?? "—" },
        { key: "p", header: tr.t("common.priority"), cell: (r) => <Badge tone={priorityTone(r.priority)}>{tr.label("tasks.priority", r.priority)}</Badge> },
        { key: "d", header: tr.t("common.deadline"), cell: (r) => fmtDate(r.deadline, tz), hideOnMobile: true },
        { key: "s", header: tr.t("common.status"), cell: (r) => <Badge tone={statusTone(r.status)}>{tr.label("tasks.status", r.status)}</Badge> },
      ]} />
  );
}

/* ------------------------------------------------------------------ documents */
export type DocRow = { id: string; name: string; document_type: string; expiry_date: string | null; version: number; status: string; entity_type: string; uploaded_at: string; file_id: string | null };
export function expiryBucket(date: string | null): { key: string; tone: "crit" | "warn" | "info" | "ok" | "off" } {
  if (!date) return { key: "ok", tone: "off" };
  const days = Math.floor((new Date(`${date}T12:00:00Z`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { key: "expired", tone: "crit" };
  if (days <= 7) return { key: "d7", tone: "crit" };
  if (days <= 14) return { key: "d14", tone: "warn" };
  if (days <= 30) return { key: "d30", tone: "warn" };
  if (days <= 60) return { key: "d60", tone: "info" };
  if (days <= 90) return { key: "d90", tone: "info" };
  return { key: "ok", tone: "ok" };
}
export function DocumentTable({ rows, tr }: { rows: DocRow[]; tr: Translator }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => `/documents?doc=${r.id}`} empty={<EmptyState title={tr.t("documents.empty")} />}
      columns={[
        { key: "n", header: tr.t("common.name"), cell: (r) => r.name },
        { key: "t", header: tr.t("documents.documentType"), cell: (r) => r.document_type },
        { key: "e", header: tr.t("documents.expiry"), cell: (r) => {
          const b = expiryBucket(r.expiry_date);
          return r.expiry_date ? <span className="flex items-center justify-end gap-2 md:justify-start">{fmtDate(r.expiry_date)} <Badge tone={b.tone}>{tr.label("documents.expiring", b.key)}</Badge></span> : "—";
        } },
        { key: "v", header: tr.t("documents.version"), cell: (r) => `v${r.version}`, hideOnMobile: true },
      ]} />
  );
}
