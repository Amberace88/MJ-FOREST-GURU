/**
 * Fuel consumption maths (pure). L/h is only computed from fills that carry engine-hour
 * readings: per machine, litres filled AFTER the first reading divided by the engine hours
 * elapsed between the first and last reading. Nothing is estimated when data is missing.
 */
export type FuelPoint = { machine_id: string | null; litres: number | string; engine_hours: number | string | null; occurred_at: string };

export type Consumption = { litres: number; hours: number; lph: number | null };

function machineConsumption(points: FuelPoint[]): Consumption {
  const withHours = points
    .filter((p) => p.engine_hours != null && Number.isFinite(Number(p.engine_hours)))
    .sort((a, b) => Number(a.engine_hours) - Number(b.engine_hours) || a.occurred_at.localeCompare(b.occurred_at));
  if (withHours.length < 2) return { litres: 0, hours: 0, lph: null };
  const hours = Number(withHours[withHours.length - 1].engine_hours) - Number(withHours[0].engine_hours);
  if (hours <= 0) return { litres: 0, hours: 0, lph: null };
  const litres = withHours.slice(1).reduce((a, p) => a + Number(p.litres), 0);
  return { litres, hours, lph: litres / hours };
}

/** Consumption per machine id. */
export function consumptionByMachine(rows: FuelPoint[]): Map<string, Consumption> {
  const groups = new Map<string, FuelPoint[]>();
  for (const r of rows) {
    if (!r.machine_id) continue;
    groups.set(r.machine_id, [...(groups.get(r.machine_id) ?? []), r]);
  }
  const out = new Map<string, Consumption>();
  for (const [id, pts] of groups) out.set(id, machineConsumption(pts));
  return out;
}

/** Fleet-level L/h: Σ measured litres / Σ measured engine hours (machines without readings are ignored). */
export function fleetConsumption(rows: FuelPoint[]): Consumption {
  let litres = 0;
  let hours = 0;
  for (const c of consumptionByMachine(rows).values()) {
    if (c.lph == null) continue;
    litres += c.litres;
    hours += c.hours;
  }
  return { litres, hours, lph: hours > 0 ? litres / hours : null };
}

/** Sum money per currency, never converting. */
export function sumByCurrency<T>(rows: T[], amount: (r: T) => number | string | null | undefined, currency: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = amount(r);
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const c = currency(r);
    out[c] = Math.round(((out[c] ?? 0) + n) * 100) / 100;
  }
  return out;
}
