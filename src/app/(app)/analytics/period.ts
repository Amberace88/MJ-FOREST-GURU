import { addDays, todayIn } from "@/lib/format";

export type PeriodKey = "this_month" | "last_month" | "custom";
export type Period = {
  key: PeriodKey;
  /** inclusive local dates (YYYY-MM-DD) in the organization's time zone */
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

export function isIsoDate(v: string | null | undefined): v is string {
  if (!v || !ISO.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function monthStart(d: string) {
  return `${d.slice(0, 7)}-01`;
}

export function monthEnd(d: string) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function shiftMonth(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Resolves the period filter from search params (?period=this_month|last_month|custom&from&to). */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, tz: string): Period {
  const today = todayIn(tz);
  if (sp.period === "last_month") {
    const from = shiftMonth(monthStart(today), -1);
    const to = monthEnd(from);
    const prevFrom = shiftMonth(from, -1);
    return { key: "last_month", from, to, prevFrom, prevTo: monthEnd(prevFrom), days: daysInclusive(from, to) };
  }
  if (sp.period === "custom" && isIsoDate(sp.from) && isIsoDate(sp.to) && sp.from <= sp.to) {
    let from = sp.from;
    const to = sp.to;
    if (daysInclusive(from, to) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
    const days = daysInclusive(from, to);
    const prevTo = addDays(from, -1);
    return { key: "custom", from, to, prevFrom: addDays(prevTo, -(days - 1)), prevTo, days };
  }
  const from = monthStart(today);
  const days = daysInclusive(from, today);
  const prevFrom = shiftMonth(from, -1);
  const prevEnd = monthEnd(prevFrom);
  const prevTo = addDays(prevFrom, days - 1) > prevEnd ? prevEnd : addDays(prevFrom, days - 1);
  return { key: "this_month", from, to: today, prevFrom, prevTo, days };
}

/** "YYYY-MM" → full month range (defaults to the current month in tz). */
export function resolveMonth(month: string | undefined, tz: string) {
  const today = todayIn(tz);
  const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? `${month}-01` : monthStart(today);
  const from = valid > today ? monthStart(today) : valid;
  const end = monthEnd(from);
  return { month: from.slice(0, 7), from, to: end > today ? today : end, monthEnd: end, isCurrent: from === monthStart(today) };
}

/** Percentage change, null when the previous value is missing or zero. */
export function pctChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** null-safe numeric coercion for RPC columns typed as number but nullable in SQL. */
export function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v;
  return n == null || !Number.isFinite(n) ? 0 : n;
}

export function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
