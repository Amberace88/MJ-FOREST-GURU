import { ArrowUpRight, Building2, Clock, Settings2, Tractor, TreePine, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { companyColor } from "@/lib/companies";
import type { OrgContext } from "@/lib/context";
import { fmtMoney, todayIn, zonedMidnightUtc } from "@/lib/format";
import { cn } from "@/lib/utils";

/** PostgREST caps responses (default max-rows 1000); a full page means the totals may be incomplete. */
const ROW_CAP = 1000;

type Totals = { projects: number; employees: number; machines: number; expensesEur: number; hours: number };

function monthRange(tz: string) {
  const today = todayIn(tz);
  const [y, m] = today.split("-").map(Number);
  const first = `${today.slice(0, 7)}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { today, first, fromUtc: zonedMidnightUtc(first, tz).toISOString(), toUtc: zonedMidnightUtc(next, tz).toISOString() };
}

/**
 * Per-company overview for the dashboard: active projects, active employees, machines,
 * this month's submitted + approved expenses (EUR only — never converted) and net work hours.
 * Work hours are attributed to the project's company, falling back to the employee's company.
 * All queries run with the user's RLS; finance / hours are shown only with the matching permission.
 */
export async function CompaniesCard({ ctx }: { ctx: OrgContext }) {
  const companies = ctx.companyId ? ctx.companies.filter((c) => c.id === ctx.companyId) : ctx.companies;
  if (companies.length === 0) return null;

  const org = ctx.org.id;
  const ids = companies.map((c) => c.id);
  const tz = ctx.timezone;
  const { today, first, fromUtc, toUtc } = monthRange(tz);
  const showFinance = ctx.can("view_finance");
  const showHours = ctx.canAny("view_employee_hours", "view_all_employees");

  const [projectsRes, employeesRes, machinesRes, expensesRes, hoursRes] = await Promise.all([
    ctx.supabase.from("projects").select("id, company_id, status")
      .eq("organization_id", org).in("company_id", ids).is("deleted_at", null).is("archived_at", null).limit(ROW_CAP),
    ctx.supabase.from("employees").select("id, company_id, status")
      .eq("organization_id", org).in("company_id", ids).is("deleted_at", null).is("archived_at", null).limit(ROW_CAP),
    ctx.supabase.from("machines").select("company_id")
      .eq("organization_id", org).in("company_id", ids).is("deleted_at", null).is("archived_at", null).limit(ROW_CAP),
    showFinance
      ? ctx.supabase.from("expenses").select("company_id, amount")
        .eq("organization_id", org).in("company_id", ids).is("deleted_at", null)
        .eq("currency", "EUR").in("status", ["submitted", "approved"])
        .gte("expense_date", first).lte("expense_date", today).limit(ROW_CAP)
      : Promise.resolve({ data: [] as { company_id: string | null; amount: number }[] }),
    showHours
      ? ctx.supabase.rpc("work_hours_between", { p_org: org, p_from: fromUtc, p_to: toUtc }).limit(ROW_CAP)
      : Promise.resolve({ data: [] as { employee_id: string; project_id: string | null; net_hours: number }[] }),
  ]);

  const totals = new Map<string, Totals>(ids.map((id) => [id, { projects: 0, employees: 0, machines: 0, expensesEur: 0, hours: 0 }]));
  const projectCompany = new Map<string, string>();
  const employeeCompany = new Map<string, string>();

  for (const p of projectsRes.data ?? []) {
    if (!p.company_id) continue;
    projectCompany.set(p.id, p.company_id);
    if (p.status === "active") totals.get(p.company_id)!.projects += 1;
  }
  for (const e of employeesRes.data ?? []) {
    if (!e.company_id) continue;
    employeeCompany.set(e.id, e.company_id);
    if (e.status === "active") totals.get(e.company_id)!.employees += 1;
  }
  for (const m of machinesRes.data ?? []) if (m.company_id) totals.get(m.company_id)!.machines += 1;
  for (const x of expensesRes.data ?? []) if (x.company_id) totals.get(x.company_id)!.expensesEur += Number(x.amount) || 0;
  for (const h of hoursRes.data ?? []) {
    const cid = (h.project_id ? projectCompany.get(h.project_id) : undefined) ?? employeeCompany.get(h.employee_id);
    const t = cid ? totals.get(cid) : undefined;
    if (t) t.hours += Number(h.net_hours) || 0;
  }

  const truncated = [projectsRes.data, employeesRes.data, machinesRes.data, expensesRes.data, hoursRes.data]
    .some((rows) => (rows?.length ?? 0) >= ROW_CAP);
  const monthLabel = new Intl.DateTimeFormat("lv", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`));

  return (
    <section className="card topo-bg overflow-hidden animate-fade-up" aria-labelledby="companies-card-title">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss"><Building2 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 id="companies-card-title" className="font-display text-lg font-semibold uppercase tracking-wide text-ink">{ctx.t("companies.card.title")}</h2>
            <p className="truncate text-xs text-muted">{ctx.t("companies.card.subtitle")} · <span className="text-ink-2">{monthLabel}</span></p>
          </div>
        </div>
        {ctx.can("manage_settings") && (
          <Link href="/settings?tab=companies" className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <Settings2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">{ctx.t("companies.card.manage")}</span>
          </Link>
        )}
      </header>

      <ul className={cn("grid gap-3 px-5 pb-5", companies.length > 1 && "md:grid-cols-2", companies.length > 2 && "2xl:grid-cols-3")}>
        {companies.map((c, i) => {
          const color = companyColor(c.color);
          const t = totals.get(c.id)!;
          const country = c.country_id ? ctx.countries.find((x) => x.id === c.country_id) : undefined;
          const q = `?company=${c.id}`;
          return (
            <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${80 + Math.min(i, 8) * 60}ms` }}>
              <article className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface-2/40 transition-colors hover:border-line-strong">
                <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-50" style={{ backgroundColor: color }} />
                <Link href={`/projects${q}`} className="relative flex items-center gap-3 px-4 py-3"
                  style={{ background: `linear-gradient(100deg, ${color}40 0%, ${color}14 55%, transparent 100%)`, borderBottom: `1px solid ${color}40` }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-base font-bold text-white"
                    style={{ backgroundColor: color, boxShadow: `0 8px 20px -8px ${color}` }} aria-hidden>
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold uppercase tracking-wide text-ink">{c.name}</span>
                    {country && <span className="block truncate text-[11px] text-muted"><span aria-hidden>{country.flag}</span> {country.name}</span>}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>

                <div className="relative grid grid-cols-3 gap-2 px-4 pt-3">
                  <Metric href={`/projects${q}`} icon={<TreePine className="h-3.5 w-3.5" />} label={ctx.t("companies.card.activeProjects")}><AnimatedNumber value={t.projects} /></Metric>
                  <Metric href={`/employees${q}`} icon={<Users className="h-3.5 w-3.5" />} label={ctx.t("companies.card.activeEmployees")}><AnimatedNumber value={t.employees} /></Metric>
                  <Metric href={`/machines${q}`} icon={<Tractor className="h-3.5 w-3.5" />} label={ctx.t("companies.card.machines")}><AnimatedNumber value={t.machines} /></Metric>
                </div>

                {(showHours || showFinance) && (
                  <div className="relative mx-4 mb-4 mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/40">
                    {showHours && (
                      <div className={cn("bg-surface px-3 py-2.5", !showFinance && "col-span-2")}>
                        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted"><Clock className="h-3.5 w-3.5 text-moss" />{ctx.t("companies.card.hoursMonth")}</span>
                        <span className="mt-1 block font-display text-xl font-bold tabular text-ink"><AnimatedNumber value={t.hours} format="hours" /></span>
                        <span className="block text-[10px] text-faint">{ctx.t("companies.card.hoursHint")}</span>
                      </div>
                    )}
                    {showFinance && (
                      <Link href={`/expenses${q}`} className={cn("bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2", !showHours && "col-span-2")}>
                        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted"><Wallet className="h-3.5 w-3.5 text-wood-300" />{ctx.t("companies.card.expensesMonth")}</span>
                        <span className="mt-1 block truncate font-display text-xl font-bold tabular text-ink">{fmtMoney(t.expensesEur, "EUR")}</span>
                        <span className="block truncate text-[10px] text-faint">{ctx.t("companies.card.expensesHint")}</span>
                      </Link>
                    )}
                  </div>
                )}
                {!showHours && !showFinance && <div className="h-4" />}
              </article>
            </li>
          );
        })}
      </ul>
      {truncated && <p className="px-5 pb-4 text-[11px] text-warn">{ctx.t("companies.card.truncated")}</p>}
    </section>
  );
}

function Metric({ href, icon, label, children }: { href: string; icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Link href={href} className="block min-w-0 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-3/60">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">{icon}<span className="truncate">{label}</span></span>
      <span className="mt-1 block font-display text-2xl font-bold leading-none tabular text-ink">{children}</span>
    </Link>
  );
}
