import type { Metadata } from "next";
import { ExternalLink, History, Lock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { Avatar, EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requirePermission } from "@/lib/context";
import { addDays, fmtDateTime, zonedMidnightUtc } from "@/lib/format";
import { likeTerm, searchParamsToString, sp as one, type Tone } from "@/lib/utils";
import { isIsoDate } from "../analytics/period";

export const metadata: Metadata = { title: "Audita žurnāls" };

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HIDDEN_KEYS = new Set(["organization_id", "updated_at", "created_at", "id", "is_demo", "idempotency_key"]);
const SENSITIVE_KEYS = /(secret|token|api_key|password|encrypted)/i;

const ACTIONS = [
  "create", "update", "delete", "deleted", "archived", "login", "logout", "login_failed", "expense_approved", "expense_rejected",
  "expense_submitted", "expense_paid", "expense_correction_requested", "work_hours_corrected", "work_hours_approved", "repair_status_changed",
  "machine_assignment_changed", "project_assignment_changed", "role_granted", "role_revoked", "permission_granted", "permission_revoked",
  "document_uploaded", "document_deleted", "integration_changed",
] as const;

const ENTITIES = [
  "organizations", "organization_settings", "countries", "employees", "employee_compensation", "teams", "projects", "work_sites",
  "project_workers", "project_teams", "project_machines", "machines", "machine_assignments", "work_logs", "production_logs", "tasks",
  "fuel_logs", "receipts", "expenses", "maintenance_records", "repair_requests", "repair_parts", "safety_rules", "safety_rule_versions",
  "employee_training", "incidents", "documents", "files", "roles", "role_permissions", "user_roles", "organization_members",
  "integration_settings", "invitations", "auth",
] as const;

/** Detail routes that exist for an audited table (entity_id = row id). */
const LINKS: Record<string, (id: string) => string> = {
  projects: (id) => `/projects/${id}`, employees: (id) => `/employees/${id}`, machines: (id) => `/machines/${id}`,
  incidents: (id) => `/incidents/${id}`, expenses: (id) => `/expenses/${id}`, repair_requests: (id) => `/repairs/${id}`,
};

function actionTone(a: string): Tone {
  if (a === "create" || a.endsWith("_granted") || a === "document_uploaded" || a.endsWith("_approved")) return "ok";
  if (a === "delete" || a === "deleted" || a.endsWith("_revoked") || a === "document_deleted" || a === "login_failed" || a.endsWith("_rejected")) return "crit";
  if (a === "login" || a === "logout") return "info";
  if (a === "archived") return "off";
  return "warn";
}

function show(v: unknown, tz: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 300);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return fmtDateTime(s, tz);
  return s.length > 300 ? `${s.slice(0, 299)}…` : s;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("view_audit_log");
  const sp = await searchParams;
  const tz = ctx.settings?.default_timezone ?? ctx.timezone;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q)?.trim();
  const user = one(sp.user);
  const action = one(sp.action);
  const entity = one(sp.entity);
  const from = one(sp.from);
  const to = one(sp.to);

  let query = ctx.supabase.from("audit_logs")
    .select("id, created_at, user_id, actor_name, action, entity, entity_id, old_values, new_values, ip_address, user_agent", { count: "exact" })
    .eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (user && UUID.test(user)) query = query.eq("user_id", user);
  if (action && (ACTIONS as readonly string[]).includes(action)) query = query.eq("action", action);
  if (entity && (ENTITIES as readonly string[]).includes(entity)) query = query.eq("entity", entity);
  if (isIsoDate(from)) query = query.gte("created_at", zonedMidnightUtc(from, tz).toISOString());
  if (isIsoDate(to)) query = query.lt("created_at", zonedMidnightUtc(addDays(to, 1), tz).toISOString());
  if (q && UUID.test(q)) query = query.eq("entity_id", q);
  else {
    const term = likeTerm(q);
    if (term) query = query.or(`actor_name.ilike.${term},action.ilike.${term},entity.ilike.${term},ip_address.ilike.${term}`);
  }

  const [logs, members] = await Promise.all([
    query,
    ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.org.id),
  ]);
  const rows = logs.data ?? [];
  const userIds = [...new Set([...(members.data ?? []).map((m) => m.user_id), ...rows.map((r) => r.user_id).filter((x): x is string => Boolean(x))])];
  const { data: profiles } = userIds.length
    ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]));
  const memberOptions = (members.data ?? []).map((m) => ({ value: m.user_id, label: names.get(m.user_id) ?? m.user_id.slice(0, 8) }))
    .sort((a, b) => a.label.localeCompare(b.label, "lv"));
  type Row = (typeof rows)[number];

  const diff = (r: Row) => {
    const ov = asRecord(r.old_values);
    const nv = asRecord(r.new_values);
    const isCreate = r.old_values == null && r.new_values != null;
    const isDelete = r.new_values == null && r.old_values != null;
    const keys = [...new Set([...Object.keys(nv), ...Object.keys(ov)])].filter((k) => !HIDDEN_KEYS.has(k));
    if (!keys.length) return <span className="text-xs text-faint">{ctx.t("audit.noChanges")}</span>;
    return (
      <details className="group max-w-[520px] text-xs">
        <summary className="cursor-pointer list-none text-muted hover:text-ink">
          <span className="underline decoration-dotted underline-offset-2">
            {isCreate ? ctx.t("audit.createdValues") : isDelete ? ctx.t("audit.deletedValues") : ctx.t("audit.changes")} · {ctx.t("audit.fieldsChanged", { n: keys.length })}
          </span>
          <span className="ml-1 text-faint">({keys.slice(0, 3).join(", ")}{keys.length > 3 ? "…" : ""})</span>
        </summary>
        <dl className="mt-2 space-y-1 rounded-lg border border-line bg-surface-2/50 p-2.5">
          {keys.map((k) => {
            const redact = SENSITIVE_KEYS.test(k);
            return (
              <div key={k} className="grid grid-cols-[minmax(90px,140px)_1fr] gap-2">
                <dt className="truncate font-medium text-ink-2" title={k}>{k}</dt>
                <dd className="min-w-0 break-words">
                  {redact ? <span className="inline-flex items-center gap-1 text-faint"><Lock className="h-3 w-3" /> •••</span> : isCreate ? (
                    <span className="text-ink">{show(nv[k], tz)}</span>
                  ) : isDelete ? (
                    <span className="text-muted line-through decoration-crit/60">{show(ov[k], tz)}</span>
                  ) : (
                    <>
                      <span className="text-muted line-through decoration-crit/60" title={ctx.t("audit.oldValue")}>{show(ov[k], tz)}</span>
                      <span className="px-1 text-faint">→</span>
                      <span className="text-ink" title={ctx.t("audit.newValue")}>{show(nv[k], tz)}</span>
                    </>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </details>
    );
  };

  const entityCell = (r: Row) => {
    if (!r.entity) return "—";
    const link = r.entity_id && UUID.test(r.entity_id) && LINKS[r.entity] && r.action !== "delete" ? LINKS[r.entity](r.entity_id) : null;
    return (
      <span className="flex min-w-0 flex-col">
        <span className="text-ink-2">{ctx.label("audit.entities", r.entity, r.entity)}</span>
        {r.entity_id && (
          link ? (
            <Link href={link} className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-amber" title={ctx.t("audit.openRecord")}>
              {r.entity_id.slice(0, 8)} <ExternalLink className="h-3 w-3" />
            </Link>
          ) : <span className="font-mono text-[11px] text-faint" title={r.entity_id}>{r.entity_id.slice(0, 8)}</span>
        )}
      </span>
    );
  };

  const userName = (r: Row) => (r.user_id ? names.get(r.user_id) : null) ?? r.actor_name ?? ctx.t("audit.system");

  return (
    <>
      <PageHeader title={ctx.t("audit.title")} subtitle={ctx.t("audit.subtitle")} />
      <p className="mb-4 flex items-start gap-2 text-xs text-muted"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ctx.t("audit.immutable", { tz })}</p>

      <FilterBar filters={[
        { type: "search", name: "q" },
        { type: "select", name: "user", label: ctx.t("audit.user"), options: memberOptions },
        { type: "select", name: "action", label: ctx.t("audit.action"), options: ACTIONS.map((a) => ({ value: a, label: ctx.label("audit.actions", a, a) })) },
        { type: "select", name: "entity", label: ctx.t("audit.entity"), options: ENTITIES.map((e) => ({ value: e, label: ctx.label("audit.entities", e, e) }))
          .sort((a, b) => a.label.localeCompare(b.label, "lv")) },
        { type: "date", name: "from", label: ctx.t("common.from") },
        { type: "date", name: "to", label: ctx.t("common.to") },
      ]} />
      {logs.count != null && logs.count > 0 && <p className="mb-2 text-xs text-faint tabular">{ctx.t("audit.total", { n: logs.count })}</p>}

      <DataTable
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty={<EmptyState icon={<History className="h-6 w-6" />} title={ctx.t("audit.empty")} />}
        mobile={(r) => (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={actionTone(r.action)}>{ctx.label("audit.actions", r.action, r.action)}</Badge>
              <span className="text-xs tabular text-muted">{fmtDateTime(r.created_at, tz)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-ink">{userName(r)}</span>
              <span className="text-xs">{entityCell(r)}</span>
            </div>
            {diff(r)}
            {r.ip_address && <div className="font-mono text-[11px] text-faint">{r.ip_address}</div>}
          </div>
        )}
        columns={[
          { key: "time", header: ctx.t("audit.time"), className: "whitespace-nowrap", cell: (r) => <span className="tabular text-ink-2">{fmtDateTime(r.created_at, tz)}</span> },
          { key: "user", header: ctx.t("audit.user"), cell: (r) => (
            <span className="flex items-center gap-2">
              <Avatar name={userName(r)} size={26} />
              <span className="max-w-[160px] truncate">{userName(r)}</span>
            </span>
          ) },
          { key: "action", header: ctx.t("audit.action"), cell: (r) => <Badge tone={actionTone(r.action)}>{ctx.label("audit.actions", r.action, r.action)}</Badge> },
          { key: "entity", header: ctx.t("audit.entity"), cell: entityCell },
          { key: "changes", header: ctx.t("audit.changes"), cell: diff },
          { key: "ip", header: ctx.t("audit.ip"), cell: (r) => (
            <span className="font-mono text-[11px] text-muted" title={r.user_agent ?? undefined}>{r.ip_address ?? "—"}</span>
          ) },
        ]}
      />
      <Pagination page={page} pageSize={PAGE} total={logs.count ?? 0} hrefFor={(p) => `/audit${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
