import type { Metadata } from "next";
import { hasServiceRole } from "@/lib/env.server";
import { grantableRoles } from "@/lib/invite";
import { Clock, HardHat, TreePine, Users } from "lucide-react";
import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { CompanyBadge } from "@/components/ui/company-badge";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { Avatar, EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { companyFilterOptions, pickCompanyFilter } from "@/lib/companies";
import { requirePermission } from "@/lib/context";
import { fmtHours } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { EmployeeCardActions, NewEmployeeDialog } from "./components";
import { liveInfo, photoUrls } from "./data";

export const metadata: Metadata = { title: "Darbinieki" };
const PAGE = 24;
const STATUSES = ["active", "on_leave", "inactive", "offboarding"] as const;
const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("view_all_employees", "view_team", "edit_employees");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const status = one(sp.status);
  const countryParam = one(sp.country) ?? ctx.countryId ?? undefined;
  const country = isUuid(countryParam) ? countryParam : undefined;
  const teamParam = one(sp.team);
  const team = teamParam === "none" || isUuid(teamParam) ? teamParam : undefined;
  const projectParam = one(sp.project);
  const project = isUuid(projectParam) ? projectParam : undefined;
  const company = pickCompanyFilter(one(sp.company), ctx.companiesAll, ctx.companyId);
  const canEdit = ctx.can("edit_employees");
  const opts = await getOptions(ctx);

  // Project filter → employee ids currently assigned to that project
  let projectEmployeeIds: string[] | null = null;
  if (project) {
    const { data } = await ctx.supabase.from("project_workers").select("employee_id")
      .eq("organization_id", ctx.org.id).eq("project_id", project).is("unassigned_at", null);
    projectEmployeeIds = (data ?? []).map((r) => r.employee_id);
  }

  let query = ctx.supabase.from("employees")
    .select("id, full_name, first_name, last_name, job_title, status, country_id, team_id, photo_path, user_id, is_demo, archived_at, company_id, email, phone, whatsapp, employment_start, employment_end, notes, team:teams!employees_team_fk(id, name)", { count: "exact" })
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .order("first_name").order("last_name").range((page - 1) * PAGE, page * PAGE - 1);
  if (status === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (status) query = query.eq("status", status);
  }
  const term = likeTerm(q);
  if (term) query = query.or(`first_name.ilike.${term},last_name.ilike.${term},job_title.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  if (country) query = query.eq("country_id", country);
  if (company) query = query.eq("company_id", company);
  if (team === "none") query = query.is("team_id", null);
  else if (team) query = query.eq("team_id", team);
  if (projectEmployeeIds) query = query.in("id", projectEmployeeIds.length ? projectEmployeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data, count } = await query;
  const rows = data ?? [];
  const [live, photos] = await Promise.all([liveInfo(ctx, rows.map((r) => r.id)), photoUrls(ctx, rows.map((r) => r.photo_path))]);
  const workingCount = [...live.values()].filter((l) => l.working).length;

  const filters: FilterDef[] = [
    { type: "search", name: "q" },
    { type: "select", name: "status", label: ctx.t("common.status"), options: [
      ...STATUSES.map((s) => ({ value: s, label: ctx.label("employees.status", s) })),
      ...(canEdit ? [{ value: "archived", label: ctx.t("employees.archived") }] : []),
    ] },
    ...(ctx.countryId ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: opts.countryOptions }]),
    ...(ctx.companyId || ctx.companies.length < 2 ? [] : [{ type: "select" as const, name: "company", label: ctx.t("companies.company"), options: companyFilterOptions(ctx.companies) }]),
    { type: "select", name: "team", label: ctx.t("common.team"), options: [{ value: "none", label: ctx.t("employees.noTeam") }, ...opts.teamOptions] },
    { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
  ];

  return (
    <>
      <PageHeader title={ctx.t("employees.title")}
        subtitle={<>{ctx.t("employees.subtitle")}{count != null && <> · <span className="tabular text-ink-2">{count}</span></>}{workingCount > 0 && <> · <span className="text-ok">{ctx.t("employees.working")}: {workingCount}</span></>}</>}
        actions={canEdit && <NewEmployeeDialog countries={opts.countryOptions} teams={opts.teamOptions} defaultOpen={one(sp.new) === "1"} roles={ctx.can("manage_users") && hasServiceRole() ? grantableRoles(ctx).map((r) => ({ value: r, label: ctx.label("users.roleNames", r) })) : undefined} />} />
      <FilterBar filters={filters} />
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={ctx.t("employees.empty")}
          action={canEdit ? <NewEmployeeDialog countries={opts.countryOptions} teams={opts.teamOptions} roles={ctx.can("manage_users") && hasServiceRole() ? grantableRoles(ctx).map((r) => ({ value: r, label: ctx.label("users.roleNames", r) })) : undefined} /> : undefined} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e, i) => {
            const c = ctx.countries.find((x) => x.id === e.country_id);
            const info = live.get(e.id);
            const teamRel = e.team as { id: string; name: string } | null;
            const co = e.company_id ? ctx.companiesAll.find((x) => x.id === e.company_id) : undefined;
            return (
              <li key={e.id} className="group relative animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                {canEdit && (
                  <div className="absolute right-3 top-3 z-10 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <EmployeeCardActions countries={opts.countryOptions} teams={opts.teamOptions} name={e.full_name ?? ""} archived={Boolean(e.archived_at)}
                      values={{ id: e.id, first_name: e.first_name, last_name: e.last_name, email: e.email, phone: e.phone, whatsapp: e.whatsapp, job_title: e.job_title,
                        country_id: e.country_id, team_id: e.team_id, status: e.status, employment_start: e.employment_start, employment_end: e.employment_end, notes: e.notes, company_id: e.company_id }} />
                  </div>
                )}
                <Link href={`/employees/${e.id}`} className="card card-hover block h-full p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar name={e.full_name} src={e.photo_path ? photos.get(e.photo_path) : null} size={48} />
                      {info?.working && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-ok" aria-label={ctx.t("employees.working")} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">{e.full_name}</span>
                        {e.is_demo && <DemoBadge />}
                      </div>
                      <p className="truncate text-xs text-muted">{e.job_title ?? "—"}{teamRel ? ` · ${teamRel.name}` : ""}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {e.archived_at ? <Badge tone="off">{ctx.t("employees.archived")}</Badge>
                          : <Badge tone={statusTone(e.status)} dot>{ctx.label("employees.status", e.status)}</Badge>}
                        {c && <span className="text-xs text-muted" title={c.name}>{c.flag} {c.code}</span>}
                        {co && <CompanyBadge name={co.name} color={co.color} className="max-w-[140px]" />}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line/70 pt-3 text-xs">
                    <div className="min-w-0">
                      <dt className="flex items-center gap-1 text-faint"><TreePine className="h-3 w-3" />{ctx.t("common.project")}</dt>
                      <dd className="mt-0.5 truncate font-medium text-ink-2">{info?.project?.code ?? "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="flex items-center gap-1 text-faint"><HardHat className="h-3 w-3" />{ctx.t("common.machine")}</dt>
                      <dd className="mt-0.5 truncate font-medium text-ink-2">{info?.machine?.name ?? "—"}</dd>
                    </div>
                    <div className="min-w-0 text-right">
                      <dt className="flex items-center justify-end gap-1 text-faint"><Clock className="h-3 w-3" />{ctx.t("common.today")}</dt>
                      <dd className={`mt-0.5 font-medium tabular ${info?.working ? "text-ok" : "text-ink-2"}`}>{info && info.todayHours > 0 ? fmtHours(info.todayHours) : "—"}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/employees${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
