/**
 * Formatting helpers. Timestamps are stored in UTC and ALWAYS rendered with an
 * explicit IANA time zone (project → country → user → organization), so DST is
 * handled by Intl — we never add/subtract hours manually.
 */
const LOCALE = "lv-LV";

export function fmtDate(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: value && typeof value === "string" && value.length === 10 ? "UTC" : tz }).format(d);
}

export function fmtTime(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(value));
}

export function fmtDateTime(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).format(new Date(value));
}

export function fmtShortDate(value: string | Date | null | undefined, tz?: string) {
  if (!value) return "—";
  const isDateOnly = typeof value === "string" && value.length === 10;
  const d = isDateOnly ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", timeZone: isDateOnly ? "UTC" : tz }).format(d);
}

export function fmtWeekday(value: string, short = true) {
  const d = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE, { weekday: short ? "short" : "long", timeZone: "UTC" }).format(d);
}

export function fmtNumber(n: number | string | null | undefined, digits = 0) {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

const CURRENCY_DIGITS: Record<string, number> = { EUR: 2, SEK: 2, ISK: 0 };

export function fmtMoney(n: number | string | null | undefined, currency = "EUR", compact = false) {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  const digits = compact ? 0 : (CURRENCY_DIGITS[currency] ?? 2);
  return new Intl.NumberFormat(LOCALE, {
    style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    notation: compact && Math.abs(v) >= 100000 ? "compact" : "standard",
  }).format(v);
}

/** Money map from DB ({"EUR": 12, "SEK": 400}) → "12,00 € · 400,00 kr" */
export function fmtMoneyMap(map: Record<string, number> | null | undefined, compact = false) {
  if (!map || Object.keys(map).length === 0) return null;
  return Object.entries(map)
    .sort(([a], [b]) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)))
    .map(([c, v]) => fmtMoney(v, c, compact))
    .join(" · ");
}

/** 9.25 → "9h 15m" */
export function fmtHours(hours: number | string | null | undefined) {
  if (hours === null || hours === undefined || hours === "") return "—";
  const v = Number(hours);
  if (!Number.isFinite(v)) return "—";
  const h = Math.floor(v + 1e-9);
  const m = Math.round((v - h) * 60);
  if (m === 60) return `${h + 1}h 00m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function hoursBetween(start: string | Date, end: string | Date | null | undefined) {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, (e - s) / 3_600_000);
}

export function fmtDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return fmtDate(new Date(value));
}

/** Today's date (YYYY-MM-DD) in a given IANA zone. */
export function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tzOffsetMs(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Wall-clock time (date + HH:mm) in an IANA zone → UTC instant. DST-safe via Intl, no manual offsets. */
export function zonedTimeToUtc(isoDate: string, hh: number, mm: number, tz: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(tz, new Date(wall));
  let res = wall - off1;
  const off2 = tzOffsetMs(tz, new Date(res));
  if (off2 !== off1) res = wall - off2;
  return new Date(res);
}

/** UTC instant of local midnight for a date in a zone. */
export function zonedMidnightUtc(isoDate: string, tz: string): Date {
  return zonedTimeToUtc(isoDate, 0, 0, tz);
}

/** Convert a local "YYYY-MM-DDTHH:mm" (from <input type=datetime-local>) in tz to a UTC ISO string. */
export function localInputToUtc(local: string, tz: string): string {
  const [date, time = "00:00"] = local.split("T");
  const [h, m] = time.split(":").map(Number);
  return zonedTimeToUtc(date, h, m, tz).toISOString();
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" in tz for <input type=datetime-local>. */
export function utcToLocalInput(iso: string | null | undefined, tz: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
