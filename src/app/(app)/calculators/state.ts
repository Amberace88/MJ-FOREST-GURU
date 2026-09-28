import type { Currency, FuelInput, JobInput, LabourInput, MachineInput, SocialTaxCountry } from "@/lib/calc";
import { SOCIAL_TAX_PRESETS } from "@/lib/calc";

export type MachineLph = { id: string; name: string; category: string; lph: number; samples: number };

/** Organization data used to prefill calculator defaults (all EUR, null when unknown/not permitted). */
export type CalcPrefill = {
  fuelPrice: number | null;
  hourlyRate: number | null;
  avgLph: number | null;
  machines: MachineLph[];
};

export const TABS = ["volume", "profit", "machine", "fuel", "labour"] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (v: unknown): v is Tab => typeof v === "string" && (TABS as readonly string[]).includes(v);

type Fields<T> = { [K in keyof T]: string };

export type LogRowState = { id: number; d: string; l: string; q: string };
export type VolumeState = {
  rows: LogRowState[];
  stacked: string; solid: string; anchor: "stacked" | "solid"; coef: string;
  loadSize: string; loadVolume: string; useTotal: boolean;
};
export type ProfitState = Fields<JobInput>;
export type MachineState = Fields<MachineInput> & { machineId: string };
export type FuelState = Fields<FuelInput> & { machineId: string };
export type LabourState = Fields<LabourInput> & { country: SocialTaxCountry | "custom" };

export type CalcState = { volume: VolumeState; profit: ProfitState; machine: MachineState; fuel: FuelState; labour: LabourState };

/** Props every calculator panel receives from the shell. */
export type CalcProps<K extends keyof CalcState> = {
  s: CalcState[K];
  set: (patch: Partial<CalcState[K]>) => void;
  reset: () => void;
  currency: Currency;
  prefill: CalcPrefill;
  /** true when `value` still equals the organization-data prefill (EUR only). */
  pre: (value: string, prefilled: number | null, digits?: number) => boolean;
};

export const CURRENCY_COUNTRY: Record<Currency, SocialTaxCountry> = { EUR: "LV", SEK: "SE", ISK: "IS" };

/** Number → input string with decimal comma, no grouping. */
export function toInput(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  const f = 10 ** digits;
  return String(Math.round(n * f) / f).replace(".", ",");
}

export function makeDefaults(p: CalcPrefill): CalcState {
  const fuelPrice = toInput(p.fuelPrice ?? 1.45, 2);
  const rate = toInput(p.hourlyRate ?? 14, 2);
  const lph = toInput(p.avgLph ?? 14, 1);
  return {
    volume: {
      rows: [
        { id: 1, d: "28", l: "5", q: "20" },
        { id: 2, d: "22", l: "4", q: "35" },
        { id: 3, d: "16", l: "3", q: "40" },
      ],
      stacked: "100", solid: "65", anchor: "stacked", coef: "0,65",
      loadSize: "40", loadVolume: "250", useTotal: true,
    },
    profit: {
      volume: "1200", price: "16",
      harvesterHours: "90", harvesterRate: "55",
      forwarderHours: "80", forwarderRate: "40",
      fuelLitres: "2400", fuelPrice,
      transportPerM3: "0",
      labourHours: "170", labourRate: rate,
      other: "500", targetMarginPct: "15",
    },
    machine: {
      purchasePrice: "450000", residualPct: "30", years: "6", hoursPerYear: "2200", interestPct: "6",
      insuranceTaxPerYear: "6000", maintenancePerHour: "12", fuelLph: lph, fuelPrice, operatorPerHour: rate, markupPct: "15",
      machineId: "",
    },
    fuel: { price: fuelPrice, lph, hours: "160", lpm3: "1,1", m3: "1500", hoursPerDay: "10", daysPerMonth: "21", machines: "2", machineId: "" },
    labour: {
      hours: "168", rate, overtimeHours: "12", overtimeMultiplier: "1,5",
      socialTaxPct: toInput(SOCIAL_TAX_PRESETS.LV, 2), country: "LV",
    },
  };
}

/** Merge a (possibly stale/partial) saved state from localStorage over the defaults. */
export function mergeSaved(defaults: CalcState, saved: unknown): CalcState {
  if (!saved || typeof saved !== "object") return defaults;
  const s = saved as Record<string, unknown>;
  const out = { ...defaults } as Record<keyof CalcState, unknown>;
  for (const key of Object.keys(defaults) as (keyof CalcState)[]) {
    const base = defaults[key] as Record<string, unknown>;
    const src = s[key];
    if (!src || typeof src !== "object") continue;
    const merged: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (!(k in base)) continue;
      if (typeof base[k] === typeof v && !Array.isArray(base[k])) merged[k] = v;
      if (k === "rows" && Array.isArray(v)) {
        const rows = v.filter((r): r is LogRowState =>
          !!r && typeof r === "object" && typeof (r as LogRowState).id === "number"
          && ["d", "l", "q"].every((f) => typeof (r as Record<string, unknown>)[f] === "string"));
        if (rows.length) merged.rows = rows.slice(0, 200);
      }
    }
    out[key] = merged;
  }
  return out as CalcState;
}
