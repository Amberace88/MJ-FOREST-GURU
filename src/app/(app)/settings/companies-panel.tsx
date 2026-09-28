import { Building2, Mail, MapPin, Phone, TreePine, Tractor, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyDot } from "@/components/ui/company-badge";
import { EmptyState } from "@/components/ui/misc";
import { companyColor } from "@/lib/companies";
import type { OrgContext } from "@/lib/context";
import { cn } from "@/lib/utils";
import { CompanyDialog, CompanyRemove, CompanyToggle, type CompanyRow } from "./companies";

const LINK_LIMIT = 10000;

/** Counts of linked records per company (one bounded query per table, aggregated in memory). */
async function linkCounts(ctx: OrgContext) {
  const org = ctx.org.id;
  const [p, e, m] = await Promise.all([
    ctx.supabase.from("projects").select("company_id").eq("organization_id", org).not("company_id", "is", null)
      .is("deleted_at", null).is("archived_at", null).limit(LINK_LIMIT),
    ctx.supabase.from("employees").select("company_id").eq("organization_id", org).not("company_id", "is", null)
      .is("deleted_at", null).is("archived_at", null).limit(LINK_LIMIT),
    ctx.supabase.from("machines").select("company_id").eq("organization_id", org).not("company_id", "is", null)
      .is("deleted_at", null).is("archived_at", null).limit(LINK_LIMIT),
  ]);
  const tally = (rows: { company_id: string | null }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) if (r.company_id) map.set(r.company_id, (map.get(r.company_id) ?? 0) + 1);
    return map;
  };
  return { projects: tally(p.data), employees: tally(e.data), machines: tally(m.data) };
}

/**
 * Companies management (Settings → Uzņēmumi and the setup wizard, step 1).
 * Editing requires manage_settings (the DB enforces it via RLS as well).
 */
export async function CompaniesPanel({ ctx, compact }: { ctx: OrgContext; compact?: boolean }) {
  const canManage = ctx.can("manage_settings");
  const [companiesRes, countriesRes, counts] = await Promise.all([
    ctx.supabase.from("companies")
      .select("id, name, legal_name, registration_number, vat_number, country_id, address, email, phone, color, is_active, sort_order")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("sort_order").order("name"),
    ctx.supabase.from("countries").select("id, name, flag, is_active").eq("organization_id", ctx.org.id).order("sort_order"),
    linkCounts(ctx),
  ]);
  const rows: CompanyRow[] = companiesRes.data ?? [];
  const countries = countriesRes.data ?? [];
  const countryOptions = countries.filter((c) => c.is_active).map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const optionsFor = (r: CompanyRow) => {
    const own = countries.find((c) => c.id === r.country_id);
    return own && !own.is_active ? [...countryOptions, { value: own.id, label: `${own.flag ?? ""} ${own.name}`.trim() }] : countryOptions;
  };

  const addButton = canManage ? <CompanyDialog countries={countryOptions} compact={compact} /> : null;

  return (
    <section className="animate-fade-up">
      {(!compact || (rows.length > 0 && addButton)) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!compact && <p className="max-w-2xl text-sm text-muted">{ctx.t("companies.hint")}</p>}
          {rows.length > 0 && <div className="sm:ml-auto">{addButton}</div>}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title={ctx.t("companies.empty")} text={ctx.t("companies.emptyHint")} action={addButton} />
      ) : (
        <ul className={cn("grid gap-4", compact ? "sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3")}>
          {rows.map((r, i) => {
            const color = companyColor(r.color);
            const country = countries.find((c) => c.id === r.country_id);
            const stats = [
              { key: "projects", icon: <TreePine className="h-3.5 w-3.5" />, label: ctx.t("nav.projects"), n: counts.projects.get(r.id) ?? 0 },
              { key: "employees", icon: <Users className="h-3.5 w-3.5" />, label: ctx.t("nav.employees"), n: counts.employees.get(r.id) ?? 0 },
              { key: "machines", icon: <Tractor className="h-3.5 w-3.5" />, label: ctx.t("nav.machines"), n: counts.machines.get(r.id) ?? 0 },
            ];
            const ids = [r.registration_number && `${ctx.t("companies.regNo")}: ${r.registration_number}`, r.vat_number && `${ctx.t("companies.vatNo")}: ${r.vat_number}`].filter(Boolean);
            return (
              <li key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <article className={cn("card topo-bg relative flex h-full flex-col overflow-hidden", !r.is_active && "opacity-70")}>
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} />
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl" style={{ backgroundColor: color }} />
                  <div className="relative flex items-start gap-3 p-5 pb-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-bold text-white shadow-lg"
                      style={{ backgroundColor: color, boxShadow: `0 10px 24px -10px ${color}` }} aria-hidden>
                      {r.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center gap-2 truncate font-display text-xl font-bold uppercase tracking-wide text-ink">
                        <span className="truncate">{r.name}</span>
                      </h3>
                      <p className="truncate text-xs text-muted">{r.legal_name ?? "—"}</p>
                    </div>
                    <Badge tone={r.is_active ? "ok" : "off"} dot>{r.is_active ? ctx.t("companies.active") : ctx.t("companies.inactive")}</Badge>
                  </div>
                  <div className="relative space-y-1.5 px-5 text-xs text-muted">
                    {country && <div className="flex items-center gap-1.5"><span aria-hidden>{country.flag}</span><span className="text-ink-2">{country.name}</span></div>}
                    {ids.length > 0 && <div className="truncate tabular">{ids.join(" · ")}</div>}
                    {r.address && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.address}</span></div>}
                    {(r.email || r.phone) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {r.email && <a href={`mailto:${r.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-ink"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.email}</span></a>}
                        {r.phone && <a href={`tel:${r.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:text-ink"><Phone className="h-3.5 w-3.5 shrink-0" />{r.phone}</a>}
                      </div>
                    )}
                  </div>
                  <dl className="relative mx-5 mt-4 grid grid-cols-3 gap-2 rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2.5">
                    {stats.map((s) => (
                      <div key={s.key} className="min-w-0">
                        <dt className="flex items-center gap-1 truncate text-[10px] uppercase tracking-wider text-faint">{s.icon}{s.label}</dt>
                        <dd className="mt-0.5 font-display text-xl font-bold tabular text-ink">{s.n}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="relative mt-auto flex items-center gap-1 px-4 pb-3 pt-3">
                    <span className="mr-auto flex items-center gap-1.5 text-[11px] text-faint">
                      <CompanyDot color={color} />{ctx.t("companies.sortOrder")}: <span className="tabular">{r.sort_order}</span>
                    </span>
                    {canManage && (
                      <>
                        <CompanyDialog company={r} countries={optionsFor(r)} compact={compact} />
                        <CompanyToggle id={r.id} active={r.is_active} />
                        <CompanyRemove id={r.id} />
                      </>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
