import type { Metadata } from "next";
import { Gauge, MapPin, Satellite, Tractor, User, Wrench } from "lucide-react";
import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { CompanyBadge } from "@/components/ui/company-badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { companyFilterOptions, pickCompanyFilter } from "@/lib/companies";
import { requireOrg } from "@/lib/context";
import { fmtNumber, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { cn, likeTerm, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { NewMachineDialog } from "./components";
import { HEALTH_ORDER, healthTone, machineHealth, type Health } from "./health";
import { CategoryIcon, HealthBadge, MACHINE_CATEGORIES, MACHINE_STATUSES, ServiceMeter } from "./ui";

export const metadata: Metadata = { title: "Tehnika" };
const PAGE = 24;

export default async function MachinesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const category = one(sp.category);
  const status = one(sp.status);
  const healthFilter = one(sp.health) as Health | undefined;
  const country = one(sp.country) ?? ctx.countryId ?? undefined;
  const company = pickCompanyFilter(one(sp.company), ctx.companiesAll, ctx.companyId);
  const today = todayIn(ctx.timezone);
  const canGps = ctx.can("view_gps");
  const canManage = ctx.can("manage_machines");

  let query = ctx.supabase.from("machines")
    .select("id, name, category, status, internal_code, registration_number, manufacturer, model, year, engine_hours, last_service_hours, service_interval_hours, next_service_hours, next_service_at, country_id, company_id, is_demo, operator:employees!machines_current_operator_id_fkey(id, full_name), project:projects!machines_current_project_id_fkey(id, code, name)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null)
    .order("name").limit(1000);
  const term = likeTerm(q);
  if (term) query = query.or(`name.ilike.${term},internal_code.ilike.${term},registration_number.ilike.${term},vin.ilike.${term},manufacturer.ilike.${term},model.ilike.${term}`);
  if (category && (MACHINE_CATEGORIES as readonly string[]).includes(category)) query = query.eq("category", category);
  if (status && (MACHINE_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (country) query = query.eq("country_id", country);
  if (company) query = query.eq("company_id", company);

  const [machinesRes, repairsRes, gpsRes, maponRes, opts] = await Promise.all([
    query,
    ctx.supabase.from("repair_requests").select("machine_id, priority").eq("organization_id", ctx.org.id).is("deleted_at", null).not("status", "in", "(completed,cancelled)"),
    canGps ? ctx.supabase.from("gps_devices").select("machine_id, provider").eq("organization_id", ctx.org.id).not("machine_id", "is", null) : Promise.resolve({ data: [] as { machine_id: string | null; provider: string }[] }),
    canGps ? ctx.supabase.from("mapon_devices").select("machine_id").eq("organization_id", ctx.org.id).not("machine_id", "is", null) : Promise.resolve({ data: [] as { machine_id: string | null }[] }),
    canManage ? getOptions(ctx) : Promise.resolve(null),
  ]);

  const openRepairs = new Map<string, { n: number; critical: boolean }>();
  for (const r of repairsRes.data ?? []) {
    const cur = openRepairs.get(r.machine_id) ?? { n: 0, critical: false };
    openRepairs.set(r.machine_id, { n: cur.n + 1, critical: cur.critical || r.priority === "critical" });
  }
  const gpsLinked = new Map<string, string>();
  for (const g of gpsRes.data ?? []) if (g.machine_id) gpsLinked.set(g.machine_id, g.provider === "mapon" ? "Mapon" : "GPS");
  for (const m of maponRes.data ?? []) if (m.machine_id) gpsLinked.set(m.machine_id, "Mapon");

  const all = (machinesRes.data ?? []).map((m) => ({
    ...m,
    h: machineHealth(m, { warningHours: ctx.settings?.service_warning_hours, openCritical: openRepairs.get(m.id)?.critical, today }),
  }));
  const counts = Object.fromEntries(HEALTH_ORDER.map((k) => [k, all.filter((m) => m.h.health === k).length])) as Record<Health, number>;
  const filtered = healthFilter && HEALTH_ORDER.includes(healthFilter) ? all.filter((m) => m.h.health === healthFilter) : all;
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const countryOptions = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const newDialog = opts && <NewMachineDialog countries={countryOptions} fuelTypes={opts.fuelTypes} defaultOpen={one(sp.new) === "1"} />;

  return (
    <>
      <PageHeader title={ctx.t("machines.title")} subtitle={ctx.t("machines.subtitle")} actions={newDialog} />

      {all.length > 0 && (
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label={ctx.t("machines.healthTitle")}>
          {HEALTH_ORDER.filter((k) => k !== "unknown" || counts.unknown > 0).map((k) => {
            const active = healthFilter === k;
            return (
              <Link key={k} href={`/machines${searchParamsToString(sp, { health: active ? null : k, page: null })}`} scroll={false}
                className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm transition-colors",
                  active ? "border-amber/60 bg-amber/10 text-ink" : "border-line bg-surface hover:border-line-strong")}>
                <Badge tone={healthTone(k)} dot pulse={k === "critical" && counts[k] > 0}>{ctx.label("machines.health", k)}</Badge>
                <span className="font-display text-lg font-bold tabular">{counts[k]}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <FilterBar filters={[
        { type: "search", name: "q", placeholder: ctx.t("machines.searchPlaceholder") },
        { type: "select", name: "category", label: ctx.t("common.category"), options: MACHINE_CATEGORIES.map((c) => ({ value: c, label: ctx.label("machines.categories", c) })) },
        { type: "select", name: "status", label: ctx.t("common.status"), options: MACHINE_STATUSES.map((s) => ({ value: s, label: ctx.label("machines.status", s) })) },
        ...(ctx.countryId || ctx.countries.length < 2 ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: countryOptions }]),
        ...(ctx.companyId || ctx.companies.length < 2 ? [] : [{ type: "select" as const, name: "company", label: ctx.t("companies.company"), options: companyFilterOptions(ctx.companies) }]),
      ]} />

      {rows.length === 0 ? (
        <EmptyState icon={<Tractor className="h-6 w-6" />} title={all.length ? ctx.t("common.noData") : ctx.t("machines.empty")}
          text={all.length ? undefined : ctx.t("machines.emptyHint")} action={all.length ? undefined : newDialog} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((m, i) => {
            const c = ctx.countries.find((x) => x.id === m.country_id);
            const rep = openRepairs.get(m.id);
            const gps = gpsLinked.get(m.id);
            const co = m.company_id ? ctx.companiesAll.find((x) => x.id === m.company_id) : undefined;
            const sub = [[m.manufacturer, m.model].filter(Boolean).join(" "), m.year, m.registration_number].filter(Boolean).join(" · ");
            return (
              <li key={m.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                <Link href={`/machines/${m.id}`} className="card card-hover topo-bg flex h-full flex-col overflow-hidden p-5">
                  <div className="flex items-start gap-3">
                    <CategoryIcon category={m.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-xl font-bold tracking-wide">{m.name}</span>
                        {m.is_demo && <DemoBadge />}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                        <span aria-hidden>{c?.flag}</span>
                        {m.internal_code && <span className="rounded bg-surface-3 px-1.5 py-px font-mono text-[11px] text-ink-2">{m.internal_code}</span>}
                        <span className="truncate">{ctx.label("machines.categories", m.category)}{sub ? ` · ${sub}` : ""}</span>
                      </p>
                    </div>
                    <Badge tone={statusTone(m.status)} dot pulse={m.status === "active" || m.status === "broken"}>{ctx.label("machines.status", m.status)}</Badge>
                  </div>

                  {co && <CompanyBadge name={co.name} color={co.color} className="mt-2.5 self-start" />}
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted">{ctx.t("machines.engineHours")}</div>
                      <div className="flex items-baseline gap-1">
                        <Gauge className="h-4 w-4 self-center text-moss" aria-hidden />
                        <span className="font-display text-2xl font-bold tabular">{m.engine_hours != null ? fmtNumber(m.engine_hours) : "—"}</span>
                        <span className="text-xs text-muted">h</span>
                      </div>
                    </div>
                    <HealthBadge h={m.h} tr={ctx} />
                  </div>
                  <div className="mt-2"><ServiceMeter h={m.h} tr={ctx} compact /></div>

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line/70 pt-3 text-xs text-muted">
                    <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.project?.code ?? "—"}</span></span>
                    <span className="flex min-w-0 items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.operator?.full_name ?? "—"}</span></span>
                    <span className="ml-auto flex items-center gap-2">
                      {rep && (
                        <span className={cn("flex items-center gap-1", rep.critical ? "text-crit" : "text-warn")} title={ctx.t("machines.openRepairs")}>
                          <Wrench className="h-3.5 w-3.5" />{rep.n}
                        </span>
                      )}
                      {canGps && (
                        <span className={cn("flex items-center gap-1", gps ? "text-moss" : "text-faint")} title={gps ? `${ctx.t("machines.gpsDevice")}: ${gps}` : ctx.t("machines.noGpsDevice")}>
                          <Satellite className="h-3.5 w-3.5" />{gps ?? ""}
                        </span>
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE} total={filtered.length} hrefFor={(p) => `/machines${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
