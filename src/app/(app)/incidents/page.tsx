import type { Metadata } from "next";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_TYPES } from "@/lib/constants";
import { AlertOctagon, ClipboardCheck, Siren, TriangleAlert } from "lucide-react";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg } from "@/lib/context";
import { addDays, fmtDateTime, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, one as first, searchParamsToString, severityTone, sp as one, statusTone } from "@/lib/utils";
import { isIsoDate } from "../analytics/period";
import { ReportIncidentDialog } from "./components";

export const metadata: Metadata = { title: "Incidenti" };
const PAGE = 25;
const OPEN = ["open", "investigating", "action_required"];

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const status = one(sp.status);
  const severity = one(sp.severity);
  const type = one(sp.type);
  const project = one(sp.project);
  const from = one(sp.from);
  const to = one(sp.to);
  const canManage = ctx.canAny("manage_incidents", "manage_safety");
  const org = ctx.org.id;
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const options = await getOptions(ctx);
  // Country switch: incidents follow their project's country; incidents without a project stay visible.
  const countryProjects = ctx.countryId ? options.projects.filter((p) => p.country_id === ctx.countryId).map((p) => p.id) : null;
  const countryFilter = countryProjects === null ? null
    : countryProjects.length ? `project_id.is.null,project_id.in.(${countryProjects.join(",")})` : "project_id.is.null";

  let query = ctx.supabase.from("incidents")
    .select("id, title, incident_type, severity, status, occurred_at, location_text, is_demo, project:projects(id, code), machine:machines(id, name), employee:employees(id, full_name)", { count: "exact" })
    .eq("organization_id", org).is("deleted_at", null)
    .order("occurred_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (countryFilter) query = query.or(countryFilter);
  const term = likeTerm(q);
  if (term) query = query.or(`title.ilike.${term},description.ilike.${term},location_text.ilike.${term}`);
  if (status && (INCIDENT_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (status === "active") query = query.in("status", OPEN);
  if (severity && (INCIDENT_SEVERITIES as readonly string[]).includes(severity)) query = query.eq("severity", severity);
  if (type && (INCIDENT_TYPES as readonly string[]).includes(type)) query = query.eq("incident_type", type);
  if (project && /^[0-9a-f-]{36}$/i.test(project)) query = query.eq("project_id", project);
  if (isIsoDate(from)) query = query.gte("occurred_at", zonedMidnightUtc(from, ctx.timezone).toISOString());
  if (isIsoDate(to)) query = query.lt("occurred_at", zonedMidnightUtc(addDays(to, 1), ctx.timezone).toISOString());

  const countQ = () => {
    const c = ctx.supabase.from("incidents").select("id", { count: "exact", head: true }).eq("organization_id", org).is("deleted_at", null);
    return countryFilter ? c.or(countryFilter) : c;
  };
  const [list, openRes, seriousRes, actionRes, recentRes] = await Promise.all([
    query,
    countQ().in("status", OPEN),
    countQ().in("status", OPEN).in("severity", ["high", "critical"]),
    countQ().eq("status", "action_required"),
    countQ().gte("occurred_at", since30),
  ]);
  const rows = list.data ?? [];

  const dialogOptions = { projects: options.projectOptions, machines: options.machineOptions, employees: options.employeeOptions };
  const dialog = (open?: boolean) => <ReportIncidentDialog orgId={org} tz={ctx.timezone} options={dialogOptions} defaultOpen={open} />;

  return (
    <>
      <PageHeader title={ctx.t("incidents.title")} subtitle={ctx.t("incidents.subtitle")} actions={dialog(one(sp.new) === "1")} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={ctx.t("incidents.openCount")} value={openRes.count ?? 0} icon={<Siren className="h-4 w-4" />} tone={(openRes.count ?? 0) > 0 ? "warn" : "forest"}
          href={`/incidents${searchParamsToString({}, { status: "active" })}`} />
        <KpiCard label={ctx.t("incidents.seriousCount")} value={seriousRes.count ?? 0} icon={<AlertOctagon className="h-4 w-4" />} tone={(seriousRes.count ?? 0) > 0 ? "crit" : "forest"} delay={40} />
        <KpiCard label={ctx.t("incidents.actionRequiredCount")} value={actionRes.count ?? 0} icon={<ClipboardCheck className="h-4 w-4" />} tone="amber" delay={80}
          href={`/incidents${searchParamsToString({}, { status: "action_required" })}`} />
        <KpiCard label={ctx.t("incidents.last30")} value={recentRes.count ?? 0} icon={<TriangleAlert className="h-4 w-4" />} tone="info" delay={120} />
      </div>

      <FilterBar filters={[
        { type: "search", name: "q" },
        { type: "select", name: "status", label: ctx.t("common.status"), options: [{ value: "active", label: ctx.t("incidents.activeFilter") }, ...INCIDENT_STATUSES.map((s) => ({ value: s, label: ctx.label("incidents.status", s) }))] },
        { type: "select", name: "severity", label: ctx.t("incidents.severityLabel"), options: INCIDENT_SEVERITIES.map((s) => ({ value: s, label: ctx.label("incidents.severity", s) })) },
        { type: "select", name: "type", label: ctx.t("incidents.typeLabel"), options: INCIDENT_TYPES.map((s) => ({ value: s, label: ctx.label("incidents.type", s) })) },
        { type: "select", name: "project", label: ctx.t("common.project"), options: options.allProjectOptions },
        { type: "date", name: "from", label: ctx.t("common.from") },
        { type: "date", name: "to", label: ctx.t("common.to") },
      ]} />
      {!canManage && <p className="mb-3 text-xs text-muted">{ctx.t("incidents.ownOnlyHint")}</p>}

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        href={(r) => `/incidents/${r.id}`}
        empty={<EmptyState icon={<Siren className="h-6 w-6" />} title={ctx.t("incidents.empty")} action={dialog()} />}
        columns={[
          { key: "title", header: ctx.t("incidents.titleLabel"), cell: (r) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 truncate">{r.title}{r.is_demo && <DemoBadge />}</span>
              <span className="text-xs font-normal text-muted">{ctx.label("incidents.type", r.incident_type)}{r.location_text ? ` · ${r.location_text}` : ""}</span>
            </span>
          ) },
          { key: "severity", header: ctx.t("incidents.severityLabel"), cell: (r) => (
            <Badge tone={severityTone(r.severity)} dot pulse={r.severity === "critical" && OPEN.includes(r.status)}>{ctx.label("incidents.severity", r.severity)}</Badge>
          ) },
          { key: "status", header: ctx.t("common.status"), cell: (r) => <Badge tone={statusTone(r.status)}>{ctx.label("incidents.status", r.status)}</Badge> },
          { key: "occurred", header: ctx.t("incidents.occurredAt"), cell: (r) => <span className="tabular text-ink-2">{fmtDateTime(r.occurred_at, ctx.timezone)}</span> },
          { key: "project", header: ctx.t("common.project"), hideOnMobile: true, cell: (r) => first(r.project)?.code ?? "—" },
          { key: "machine", header: ctx.t("common.machine"), hideOnMobile: true, cell: (r) => first(r.machine)?.name ?? "—" },
          { key: "employee", header: ctx.t("incidents.involvedEmployee"), hideOnMobile: true, cell: (r) => first(r.employee)?.full_name ?? "—" },
        ]}
      />
      <Pagination page={page} pageSize={PAGE} total={list.count ?? 0} hrefFor={(p) => `/incidents${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
