import type { Metadata } from "next";
import { CalendarDays, MapPin, TreePine, Users } from "lucide-react";
import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { CompanyBadge } from "@/components/ui/company-badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState, PageHeader, Pagination, Progress } from "@/components/ui/misc";
import { companyFilterOptions, pickCompanyFilter } from "@/lib/companies";
import { requireOrg } from "@/lib/context";
import { fmtDate } from "@/lib/format";
import { likeTerm, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { NewProjectDialog } from "./components";

export const metadata: Metadata = { title: "Darba objekti" };
const PAGE = 24;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1));
  const q = one(sp.q);
  const status = one(sp.status);
  const country = one(sp.country) ?? ctx.countryId ?? undefined;
  const company = pickCompanyFilter(one(sp.company), ctx.companiesAll, ctx.companyId);

  let query = ctx.supabase.from("projects")
    .select("id, code, name, client_name, status, country_id, start_date, expected_end_date, location_name, site_identifiers, is_demo, company_id, project_workers(count), project_machines(count)", { count: "exact" })
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null)
    .is("project_workers.unassigned_at", null).is("project_machines.unassigned_at", null)
    .order("status", { ascending: true }).order("code").range((page - 1) * PAGE, page * PAGE - 1);
  const term = likeTerm(q);
  if (term) query = query.or(`code.ilike.${term},name.ilike.${term},client_name.ilike.${term}`);
  if (status) query = query.eq("status", status);
  if (country) query = query.eq("country_id", country);
  if (company) query = query.eq("company_id", company);
  const { data, count } = await query;
  const rows = data ?? [];
  const canCreate = ctx.can("manage_projects") && ctx.can("view_all_projects");

  return (
    <>
      <PageHeader title={ctx.t("projects.title")} subtitle={ctx.t("projects.subtitle")}
        actions={canCreate && <NewProjectDialog countries={ctx.countries} defaultOpen={one(sp.new) === "1"} />} />
      <FilterBar filters={[
        { type: "search", name: "q" },
        { type: "select", name: "status", label: ctx.t("common.status"), options: ["active", "planned", "paused", "completed", "cancelled"].map((s) => ({ value: s, label: ctx.label("projects.status", s) })) },
        ...(ctx.countryId ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}` })) }]),
        ...(ctx.companyId || ctx.companies.length < 2 ? [] : [{ type: "select" as const, name: "company", label: ctx.t("companies.company"), options: companyFilterOptions(ctx.companies) }]),
      ]} />
      {rows.length === 0 ? (
        <EmptyState icon={<TreePine className="h-6 w-6" />} title={ctx.t("projects.empty")} action={canCreate ? <NewProjectDialog countries={ctx.countries} /> : undefined} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((p, i) => {
            const c = ctx.countries.find((x) => x.id === p.country_id);
            const start = p.start_date ? new Date(p.start_date).getTime() : null;
            const end = p.expected_end_date ? new Date(p.expected_end_date).getTime() : null;
            const pct = start && end && end > start ? ((Date.now() - start) / (end - start)) * 100 : null;
            const daysLeft = end ? Math.ceil((end - Date.now()) / 86_400_000) : null;
            const ids = Object.entries((p.site_identifiers ?? {}) as Record<string, string>).slice(0, 2);
            const co = p.company_id ? ctx.companiesAll.find((x) => x.id === p.company_id) : undefined;
            const workers = (p.project_workers as unknown as { count: number }[])?.[0]?.count ?? 0;
            const machines = (p.project_machines as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                <Link href={`/projects/${p.id}`} className="card card-hover topo-bg block h-full overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden>{c?.flag}</span>
                        <span className="font-display text-2xl font-bold tracking-wide">{p.code}</span>
                        {p.is_demo && <DemoBadge />}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink-2">{p.name}</p>
                    </div>
                    <Badge tone={statusTone(p.status)} dot pulse={p.status === "active"}>{ctx.label("projects.status", p.status)}</Badge>
                  </div>
                  {co && <CompanyBadge name={co.name} color={co.color} className="mt-2.5" />}
                  <div className="mt-4 space-y-1.5 text-xs text-muted">
                    {p.client_name && <div className="truncate">{ctx.t("projects.client")}: <span className="text-ink-2">{p.client_name}</span></div>}
                    {p.location_name && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{p.location_name}</div>}
                    {ids.map(([k, v]) => <div key={k} className="truncate">{ctx.label("projects.identifierFields", k)}: <span className="text-ink-2">{v}</span></div>)}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {workers}</span>
                    <span className="flex items-center gap-1.5">🚜 {machines}</span>
                    <span className="ml-auto flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(p.start_date)} – {fmtDate(p.expected_end_date)}</span>
                  </div>
                  {pct !== null && p.status === "active" && (
                    <div className="mt-3">
                      <Progress value={pct} tone={daysLeft !== null && daysLeft < 0 ? "crit" : daysLeft !== null && daysLeft <= 7 ? "amber" : "forest"} />
                      <div className="mt-1 text-right text-[11px] text-faint">{daysLeft !== null && (daysLeft < 0 ? ctx.t("projects.overdue") : ctx.t("projects.daysLeft", { n: daysLeft }))}</div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/projects${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
