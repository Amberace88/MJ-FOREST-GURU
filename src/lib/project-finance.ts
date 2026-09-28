/**
 * Project (work-site) finances: revenue from contract terms vs. actual costs
 * (labour, fuel, expenses, repairs) with budget usage and a pace-based forecast.
 *
 * Money is never converted: everything is computed in the project's contract
 * currency (EUR by default); amounts in other currencies are reported separately.
 * Used by the project "Finanses" tab and the dashboard ProfitabilityCard (server only).
 */
import { isCurrency, verdictFor, type Currency, type Verdict } from "@/lib/calc";
import type { OrgContext } from "@/lib/context";
import type { Tables } from "@/lib/database.types";
import { addDays, hoursBetween } from "@/lib/format";

export const CONTRACT_TYPES = ["per_unit", "fixed", "hourly"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];
export const CONTRACT_UNITS = ["m3", "units", "loads", "other"] as const;
export type MoneyMap = Record<string, number>;

export const FINANCE_PROJECT_COLUMNS =
  "id, code, name, status, start_date, expected_end_date, actual_end_date, contract_type, contract_price, contract_currency, contract_unit, expected_volume, budget_hours, budget_cost" as const;

export type FinanceProject = Pick<Tables<"projects">,
  "id" | "code" | "name" | "status" | "start_date" | "expected_end_date" | "actual_end_date" | "contract_type" | "contract_price"
  | "contract_currency" | "contract_unit" | "expected_volume" | "budget_hours" | "budget_cost">;

/** Raw per-project facts (already filtered to the project). Dates are ISO strings. */
export type FinanceRaw = {
  production: { date: string; quantity: number; unit: string }[];
  work: { employeeId: string; date: string; netHours: number }[];
  /** employee_id → hourly rate; null when the viewer may not see salaries */
  rates: Map<string, { rate: number; currency: string }> | null;
  fuel: { date: string; litres: number; amount: number | null; currency: string }[];
  expenses: { date: string; amount: number; currency: string }[];
  repairs: { date: string; amount: number; currency: string }[];
};

export type CostKey = "labour" | "fuel" | "expenses" | "repairs";
export const COST_KEYS: CostKey[] = ["labour", "fuel", "expenses", "repairs"];

export type ProjectFinance = {
  projectId: string;
  currency: Currency;
  contractType: ContractType | null;
  contractPrice: number | null;
  contractUnit: string;
  hasContract: boolean;
  volume: number;
  volumeM3: number;
  production: Record<string, number>;
  hours: number;
  labourKnown: boolean;
  unratedHours: number;
  fuelLitres: number;
  costs: Record<CostKey, number | null>;
  totalCost: number;
  otherCurrencies: MoneyMap;
  revenue: number | null;
  profit: number | null;
  marginPct: number | null;
  costPerM3: number | null;
  progress: number | null;
  progressMethod: "volume" | "time" | null;
  budget: { hours: number | null; hoursPct: number | null; cost: number | null; costPct: number | null };
  forecast: {
    revenue: number | null; cost: number; profit: number | null; marginPct: number | null; hours: number;
    finishDate: string | null; overBudget: number | null;
  } | null;
  verdict: Verdict;
};

const RECENT_DAYS = 30;
const n = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v) || 0);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const asContractType = (v: string | null): ContractType | null => ((CONTRACT_TYPES as readonly string[]).includes(v ?? "") ? (v as ContractType) : null);

/** Pure computation (unit-testable). `today` is YYYY-MM-DD in the organization's zone. */
export function computeProjectFinance(p: FinanceProject, raw: FinanceRaw, today: string): ProjectFinance {
  const currency: Currency = isCurrency(p.contract_currency) ? p.contract_currency : "EUR";
  const contractType = asContractType(p.contract_type);
  const price = p.contract_price === null ? null : n(p.contract_price);
  const unit = p.contract_unit || "m3";
  const recentFrom = addDays(today, -RECENT_DAYS);
  const isRecent = (d: string) => d.slice(0, 10) > recentFrom;

  const costs: Record<CostKey, number> = { labour: 0, fuel: 0, expenses: 0, repairs: 0 };
  let recentCost = 0;
  const other: MoneyMap = {};
  const add = (key: CostKey, cur: string, amount: number, date: string) => {
    if (!(amount > 0)) return;
    if (cur !== currency) { other[cur] = (other[cur] ?? 0) + amount; return; }
    costs[key] += amount;
    if (isRecent(date)) recentCost += amount;
  };

  // production
  const production: Record<string, number> = {};
  let volume = 0;
  let recentVolume = 0;
  for (const r of raw.production) {
    production[r.unit] = (production[r.unit] ?? 0) + r.quantity;
    if (r.unit === unit) {
      volume += r.quantity;
      if (isRecent(r.date)) recentVolume += r.quantity;
    }
  }
  const volumeM3 = production.m3 ?? 0;

  // labour
  let hours = 0;
  let recentHours = 0;
  let unratedHours = 0;
  for (const w of raw.work) {
    hours += w.netHours;
    if (isRecent(w.date)) recentHours += w.netHours;
    if (!raw.rates) continue;
    const rate = raw.rates.get(w.employeeId);
    if (!rate || !(rate.rate > 0)) { unratedHours += w.netHours; continue; }
    add("labour", rate.currency, w.netHours * rate.rate, w.date);
  }

  let fuelLitres = 0;
  for (const f of raw.fuel) {
    fuelLitres += f.litres;
    if (f.amount !== null) add("fuel", f.currency, f.amount, f.date);
  }
  for (const e of raw.expenses) add("expenses", e.currency, e.amount, e.date);
  for (const r of raw.repairs) add("repairs", r.currency, r.amount, r.date);

  const totalCost = costs.labour + costs.fuel + costs.expenses + costs.repairs;

  // progress
  let progress: number | null = null;
  let progressMethod: ProjectFinance["progressMethod"] = null;
  const expected = p.expected_volume === null ? 0 : n(p.expected_volume);
  if (expected > 0) {
    progress = Math.min(1, volume / expected);
    progressMethod = "volume";
  } else if (p.status === "completed" || p.actual_end_date) {
    progress = 1;
    progressMethod = "time";
  } else if (p.start_date && p.expected_end_date && p.expected_end_date > p.start_date) {
    progress = Math.max(0, Math.min(1, dayDiff(p.start_date, today) / dayDiff(p.start_date, p.expected_end_date)));
    progressMethod = "time";
  }

  // revenue
  const hasContract = contractType !== null && price !== null;
  let revenue: number | null = null;
  if (hasContract) {
    if (contractType === "per_unit") revenue = volume * price;
    else if (contractType === "hourly") revenue = hours * price;
    else if (progress !== null) revenue = price * progress;
  }
  const profit = revenue === null ? null : revenue - totalCost;
  const marginPct = revenue !== null && revenue > 0 && profit !== null ? (profit / revenue) * 100 : null;

  const budgetHours = p.budget_hours === null ? null : n(p.budget_hours);
  const budgetCost = p.budget_cost === null ? null : n(p.budget_cost);

  // forecast — remaining work at the recent (30 d) pace, falling back to the all-time pace
  let forecast: ProjectFinance["forecast"] = null;
  if (hasContract && progress !== null && totalCost > 0) {
    let finalCost = totalCost;
    let finalHours = hours;
    let finalVolume = volume;
    let finishDate: string | null = p.actual_end_date ?? null;
    if (progress < 1 && progressMethod === "volume") {
      const remaining = Math.max(0, expected - volume);
      const unitCost = recentVolume > 0 ? recentCost / recentVolume : volume > 0 ? totalCost / volume : null;
      const unitHours = recentVolume > 0 ? recentHours / recentVolume : volume > 0 ? hours / volume : null;
      if (unitCost !== null && unitHours !== null) {
        finalCost = totalCost + remaining * unitCost;
        finalHours = hours + remaining * unitHours;
        finalVolume = expected;
        finishDate = recentVolume > 0 ? addDays(today, Math.ceil(remaining / (recentVolume / RECENT_DAYS))) : null;
      } else {
        finalCost = NaN;
      }
    } else if (progress < 1 && progressMethod === "time" && p.start_date && p.expected_end_date) {
      const remainingDays = Math.max(0, dayDiff(today, p.expected_end_date));
      const windowDays = Math.max(1, Math.min(RECENT_DAYS, dayDiff(p.start_date, today)));
      finalCost = totalCost + remainingDays * (recentCost / windowDays);
      finalHours = hours + remainingDays * (recentHours / windowDays);
      finalVolume = volume + remainingDays * (recentVolume / windowDays);
      finishDate = p.expected_end_date;
    }
    if (Number.isFinite(finalCost)) {
      let finalRevenue: number | null = null;
      if (contractType === "fixed") finalRevenue = price;
      else if (contractType === "hourly") finalRevenue = finalHours * price;
      else if (contractType === "per_unit") finalRevenue = finalVolume * price;
      const finalProfit = finalRevenue === null ? null : finalRevenue - finalCost;
      forecast = {
        revenue: finalRevenue, cost: finalCost, profit: finalProfit, hours: finalHours, finishDate,
        marginPct: finalRevenue && finalRevenue > 0 && finalProfit !== null ? (finalProfit / finalRevenue) * 100 : null,
        overBudget: budgetCost !== null && budgetCost > 0 && finalCost > budgetCost ? finalCost - budgetCost : null,
      };
    }
  }

  return {
    projectId: p.id, currency, contractType, contractPrice: price, contractUnit: unit, hasContract,
    volume, volumeM3, production, hours, labourKnown: raw.rates !== null, unratedHours, fuelLitres,
    costs: { ...costs, labour: raw.rates ? costs.labour : null },
    totalCost, otherCurrencies: other, revenue, profit, marginPct,
    costPerM3: volumeM3 > 0 ? totalCost / volumeM3 : null,
    progress, progressMethod,
    budget: {
      hours: budgetHours, hoursPct: budgetHours && budgetHours > 0 ? (hours / budgetHours) * 100 : null,
      cost: budgetCost, costPct: budgetCost && budgetCost > 0 ? (totalCost / budgetCost) * 100 : null,
    },
    forecast,
    verdict: verdictFor(marginPct),
  };
}

/* ------------------------------------------------------------------ data loading */

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** PostgREST caps responses at 1000 rows — page until exhausted (or cap). */
async function pageAll<T>(page: (from: number, to: number) => Page<T>, cap = 50000, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < cap; offset += size) {
    const { data, error } = await page(offset, offset + size - 1);
    if (error) break;
    out.push(...(data ?? []));
    if ((data ?? []).length < size) break;
  }
  return out;
}

function emptyRaw(rates: FinanceRaw["rates"]): FinanceRaw {
  return { production: [], work: [], rates, fuel: [], expenses: [], repairs: [] };
}

/**
 * Loads raw facts for many projects in one batch (RLS applies — the caller should
 * gate on `view_finance`) and returns computed finances keyed by project id.
 */
export async function loadProjectFinances(ctx: OrgContext, projects: FinanceProject[], today: string): Promise<Map<string, ProjectFinance>> {
  const result = new Map<string, ProjectFinance>();
  if (!projects.length) return result;
  const ids = projects.map((p) => p.id);
  const org = ctx.org.id;
  const sb = ctx.supabase;

  const [production, work, comp, fuel, expenses, repairs] = await Promise.all([
    pageAll((a, b) => sb.from("production_logs").select("id, project_id, production_date, quantity, unit")
      .eq("organization_id", org).in("project_id", ids).is("deleted_at", null).order("id").range(a, b)),
    pageAll((a, b) => sb.from("work_logs").select("id, project_id, employee_id, started_at, ended_at, breaks:work_breaks(started_at, ended_at)")
      .eq("organization_id", org).in("project_id", ids).is("deleted_at", null).order("id").range(a, b)),
    ctx.can("view_salaries")
      ? sb.from("employee_compensation").select("employee_id, hourly_rate, currency").eq("organization_id", org).then((r) => r.data ?? [])
      : Promise.resolve(null),
    pageAll((a, b) => sb.from("fuel_logs").select("id, project_id, occurred_at, litres, total_amount, currency")
      .eq("organization_id", org).in("project_id", ids).is("deleted_at", null).order("id").range(a, b)),
    pageAll((a, b) => sb.from("expenses").select("id, project_id, expense_date, amount, currency")
      .eq("organization_id", org).in("project_id", ids).is("deleted_at", null).in("status", ["approved", "paid"])
      .neq("category", "fuel") // fuel is counted from fuel_logs (avoids double counting)
      .order("id").range(a, b)),
    pageAll((a, b) => sb.from("repair_requests").select("id, project_id, created_at, completed_at, labour_cost, external_cost, currency, parts:repair_parts(quantity, unit_cost, currency)")
      .eq("organization_id", org).in("project_id", ids).is("deleted_at", null).neq("status", "cancelled").order("id").range(a, b)),
  ]);

  const rates: FinanceRaw["rates"] = comp
    ? new Map(comp.filter((c) => c.hourly_rate !== null).map((c) => [c.employee_id, { rate: n(c.hourly_rate), currency: c.currency }]))
    : null;
  const raws = new Map<string, FinanceRaw>(ids.map((id) => [id, emptyRaw(rates)]));

  for (const r of production) raws.get(r.project_id)?.production.push({ date: r.production_date, quantity: n(r.quantity), unit: r.unit });
  for (const w of work) {
    if (!w.project_id) continue;
    const gross = hoursBetween(w.started_at, w.ended_at);
    const brk = (w.breaks ?? []).reduce((acc, b) => acc + hoursBetween(b.started_at, b.ended_at), 0);
    raws.get(w.project_id)?.work.push({ employeeId: w.employee_id, date: w.started_at, netHours: Math.max(0, gross - brk) });
  }
  for (const f of fuel) {
    if (!f.project_id) continue;
    raws.get(f.project_id)?.fuel.push({ date: f.occurred_at, litres: n(f.litres), amount: f.total_amount === null ? null : n(f.total_amount), currency: f.currency });
  }
  for (const e of expenses) {
    if (!e.project_id) continue;
    raws.get(e.project_id)?.expenses.push({ date: e.expense_date, amount: n(e.amount), currency: e.currency });
  }
  for (const r of repairs) {
    const raw = r.project_id ? raws.get(r.project_id) : undefined;
    if (!raw) continue;
    const date = r.completed_at ?? r.created_at;
    raw.repairs.push({ date, amount: n(r.labour_cost) + n(r.external_cost), currency: r.currency });
    for (const part of r.parts ?? []) raw.repairs.push({ date, amount: n(part.quantity) * n(part.unit_cost), currency: part.currency });
  }

  for (const p of projects) result.set(p.id, computeProjectFinance(p, raws.get(p.id) ?? emptyRaw(rates), today));
  return result;
}
