import "server-only";
import type { OrgContext } from "@/lib/context";
import { fetchAll } from "../analytics/fetch-all";
import type { CalcPrefill, MachineLph } from "./state";

const DAY = 86_400_000;

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function avgFuelPrice(ctx: OrgContext): Promise<number | null> {
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const { rows } = await fetchAll<{ litres: number; total_amount: number | null }>((from, to) =>
    ctx.supabase.from("fuel_logs").select("litres, total_amount")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).eq("currency", "EUR")
      .not("total_amount", "is", null).gte("occurred_at", since)
      .order("occurred_at").range(from, to), 10000);
  let litres = 0;
  let amount = 0;
  for (const r of rows) {
    if (r.total_amount == null || !(Number(r.litres) > 0)) continue;
    litres += Number(r.litres);
    amount += Number(r.total_amount);
  }
  return litres > 0 && amount > 0 ? amount / litres : null;
}

/** Median litres per engine hour per machine from consecutive refuels with engine-hour readings. */
async function machineConsumption(ctx: OrgContext): Promise<MachineLph[]> {
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const { rows } = await fetchAll<{ machine_id: string | null; occurred_at: string; litres: number; engine_hours: number | null }>((from, to) =>
    ctx.supabase.from("fuel_logs").select("machine_id, occurred_at, litres, engine_hours")
      .eq("organization_id", ctx.org.id).is("deleted_at", null)
      .not("machine_id", "is", null).not("engine_hours", "is", null).gte("occurred_at", since)
      .order("machine_id").order("occurred_at").range(from, to), 10000);

  const byMachine = new Map<string, { t: string; l: number; eh: number }[]>();
  for (const r of rows) {
    if (!r.machine_id || r.engine_hours == null) continue;
    const list = byMachine.get(r.machine_id) ?? [];
    list.push({ t: r.occurred_at, l: Number(r.litres), eh: Number(r.engine_hours) });
    byMachine.set(r.machine_id, list);
  }
  const rates = new Map<string, number[]>();
  for (const [id, list] of byMachine) {
    list.sort((a, b) => a.t.localeCompare(b.t));
    for (let i = 1; i < list.length; i++) {
      const dh = list[i].eh - list[i - 1].eh;
      if (dh <= 0.5) continue;
      const lph = list[i].l / dh;
      if (lph > 0.3 && lph < 120) rates.set(id, [...(rates.get(id) ?? []), lph]);
    }
  }
  const ids = [...rates.keys()].filter((id) => (rates.get(id)?.length ?? 0) >= 3);
  if (!ids.length) return [];
  const { data: machines } = await ctx.supabase.from("machines").select("id, name, category")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).in("id", ids);
  return (machines ?? [])
    .map((m) => ({ id: m.id, name: m.name, category: m.category, lph: median(rates.get(m.id) ?? []), samples: rates.get(m.id)?.length ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "lv"));
}

async function avgHourlyRate(ctx: OrgContext): Promise<number | null> {
  const { data } = await ctx.supabase.from("employee_compensation")
    .select("hourly_rate, currency, employee:employees(status, deleted_at)")
    .eq("organization_id", ctx.org.id).eq("currency", "EUR").not("hourly_rate", "is", null);
  const rates = (data ?? [])
    .filter((r) => {
      const e = r.employee as { status: string; deleted_at: string | null } | null;
      return r.hourly_rate != null && Number(r.hourly_rate) > 0 && (!e || (e.status === "active" && !e.deleted_at));
    })
    .map((r) => Number(r.hourly_rate));
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
}

export async function loadCalcPrefill(ctx: OrgContext): Promise<CalcPrefill> {
  const seesFuel = ctx.canAny("view_fuel", "view_finance", "view_analytics");
  const [fuelPrice, machines, hourlyRate] = await Promise.all([
    seesFuel ? avgFuelPrice(ctx).catch(() => null) : Promise.resolve(null),
    seesFuel ? machineConsumption(ctx).catch(() => []) : Promise.resolve([]),
    ctx.can("view_salaries") ? avgHourlyRate(ctx).catch(() => null) : Promise.resolve(null),
  ]);
  const avgLph = machines.length ? machines.reduce((a, m) => a + m.lph, 0) / machines.length : null;
  return { fuelPrice, hourlyRate, avgLph, machines };
}
