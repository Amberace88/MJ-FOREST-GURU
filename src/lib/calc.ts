/**
 * Pure business calculations shared by the calculators page (client) and project
 * finances (server). No I/O, no currency conversion — every function works in a
 * single currency chosen by the caller.
 */

export const CURRENCIES = ["EUR", "SEK", "ISK"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

const SYMBOLS: Record<Currency, string> = { EUR: "€", SEK: "kr", ISK: "kr" };
export function currencySymbol(c: string) {
  return isCurrency(c) ? SYMBOLS[c] : c;
}

/** Margin (%) under which a job is considered "thin". */
export const THIN_MARGIN_PCT = 10;

export type Verdict = "profit" | "thin" | "loss" | "unknown";

export function verdictFor(marginPct: number | null | undefined): Verdict {
  if (marginPct === null || marginPct === undefined || !Number.isFinite(marginPct)) return "unknown";
  if (marginPct < 0) return "loss";
  if (marginPct < THIN_MARGIN_PCT) return "thin";
  return "profit";
}

/** Lenient number parsing for text inputs: accepts "1,5", "1 200", "" → 0. */
export function parseNum(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(v.replace(/\s| /g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Division that returns null instead of Infinity/NaN. */
export function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

/* ------------------------------------------------------------ timber volume */

/** Huber formula: V = π/4 · d² · L (d in cm at mid-length, L in m) → m³. */
export function huberVolume(diameterCm: number, lengthM: number) {
  if (diameterCm <= 0 || lengthM <= 0) return 0;
  const d = diameterCm / 100;
  return (Math.PI / 4) * d * d * lengthM;
}

export type LogRow = { diameter: number; length: number; quantity: number };

export function logsVolume(rows: LogRow[]) {
  const perRow = rows.map((r) => huberVolume(r.diameter, r.length) * Math.max(0, r.quantity));
  return { perRow, total: perRow.reduce((a, b) => a + b, 0), pieces: rows.reduce((a, r) => a + Math.max(0, r.quantity), 0) };
}

/** Stacked (piled) volume ↔ solid volume. coefficient = solid m³ per stacked m³. */
export const stackedToSolid = (stacked: number, coefficient: number) => stacked * coefficient;
export const solidToStacked = (solid: number, coefficient: number) => (coefficient > 0 ? solid / coefficient : 0);

export function truckLoads(totalM3: number, loadM3: number) {
  if (loadM3 <= 0 || totalM3 <= 0) return { loads: 0, full: 0, remainder: 0 };
  const full = Math.floor(totalM3 / loadM3 + 1e-9);
  const remainder = Math.max(0, totalM3 - full * loadM3);
  return { loads: remainder > 1e-6 ? full + 1 : full, full, remainder };
}

/* ------------------------------------------------------------ job profitability */

export type JobInput = {
  volume: number; price: number;
  harvesterHours: number; harvesterRate: number;
  forwarderHours: number; forwarderRate: number;
  fuelLitres: number; fuelPrice: number;
  transportPerM3: number;
  labourHours: number; labourRate: number;
  other: number;
  targetMarginPct: number;
};

export function jobProfitability(i: JobInput) {
  const costs = {
    harvester: i.harvesterHours * i.harvesterRate,
    forwarder: i.forwarderHours * i.forwarderRate,
    fuel: i.fuelLitres * i.fuelPrice,
    transport: i.transportPerM3 * i.volume,
    labour: i.labourHours * i.labourRate,
    other: i.other,
  };
  const revenue = i.volume * i.price;
  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  const costPerM3 = safeDiv(totalCost, i.volume);
  const tm = Math.min(95, Math.max(0, i.targetMarginPct)) / 100;
  const targetPrice = costPerM3 === null ? null : costPerM3 / (1 - tm);
  return { costs, revenue, totalCost, profit, marginPct, costPerM3, breakEvenPrice: costPerM3, targetPrice, verdict: verdictFor(marginPct) };
}

/* ------------------------------------------------------------ machine hourly cost */

export type MachineInput = {
  purchasePrice: number; residualPct: number; years: number; hoursPerYear: number; interestPct: number;
  insuranceTaxPerYear: number; maintenancePerHour: number; fuelLph: number; fuelPrice: number; operatorPerHour: number;
  markupPct: number;
};

export function machineHourlyCost(i: MachineInput) {
  const residual = i.purchasePrice * Math.min(100, Math.max(0, i.residualPct)) / 100;
  const lifetimeHours = i.years * i.hoursPerYear;
  const parts = {
    depreciation: lifetimeHours > 0 ? (i.purchasePrice - residual) / lifetimeHours : 0,
    interest: i.hoursPerYear > 0 ? ((i.purchasePrice + residual) / 2) * (i.interestPct / 100) / i.hoursPerYear : 0,
    insurance: i.hoursPerYear > 0 ? i.insuranceTaxPerYear / i.hoursPerYear : 0,
    maintenance: i.maintenancePerHour,
    fuel: i.fuelLph * i.fuelPrice,
    operator: i.operatorPerHour,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  const ownership = parts.depreciation + parts.interest + parts.insurance;
  /** Machine-only rate (without fuel & operator) — what the job calculator expects as €/h. */
  const machineOnly = ownership + parts.maintenance;
  return {
    parts, total, ownership, machineOnly, residual,
    suggestedRate: total * (1 + i.markupPct / 100),
    perYear: total * i.hoursPerYear,
  };
}

/* ------------------------------------------------------------ fuel */

export type FuelInput = {
  price: number; lph: number; hours: number; lpm3: number; m3: number;
  hoursPerDay: number; daysPerMonth: number; machines: number;
};

export function fuelCost(i: FuelInput) {
  const byHoursL = i.lph * i.hours;
  const byVolumeL = i.lpm3 * i.m3;
  const monthlyHours = i.hoursPerDay * i.daysPerMonth * i.machines;
  const monthlyL = i.lph * monthlyHours;
  return {
    byHours: { litres: byHoursL, cost: byHoursL * i.price },
    byVolume: { litres: byVolumeL, cost: byVolumeL * i.price, perM3: i.lpm3 * i.price },
    monthly: { hours: monthlyHours, litres: monthlyL, cost: monthlyL * i.price, yearly: monthlyL * i.price * 12 },
  };
}

/* ------------------------------------------------------------ labour */

export const SOCIAL_TAX_PRESETS = { LV: 23.59, SE: 31.42, IS: 6.35 } as const;
export type SocialTaxCountry = keyof typeof SOCIAL_TAX_PRESETS;

export type LabourInput = { hours: number; rate: number; overtimeHours: number; overtimeMultiplier: number; socialTaxPct: number };

export function labourCost(i: LabourInput) {
  const base = i.hours * i.rate;
  const overtime = i.overtimeHours * i.rate * i.overtimeMultiplier;
  const gross = base + overtime;
  const tax = gross * (i.socialTaxPct / 100);
  const employerCost = gross + tax;
  const totalHours = i.hours + i.overtimeHours;
  return { base, overtime, gross, tax, employerCost, totalHours, costPerHour: safeDiv(employerCost, totalHours) };
}
