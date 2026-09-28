import type { ExportFormat } from "@/app/(app)/reports/config";

export type Cell = string | number | boolean | null | undefined;

/** Characters that make spreadsheet apps evaluate a cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvDialect(format: ExportFormat) {
  return format === "excel"
    ? { delimiter: ";", decimal: ",", bom: "﻿" }
    : { delimiter: ",", decimal: ".", bom: "" };
}

function formatNumber(n: number, decimal: string) {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 1000) / 1000;
  const s = String(rounded);
  return decimal === "." ? s : s.replace(".", decimal);
}

export function csvCell(v: Cell, d: ReturnType<typeof csvDialect>): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return formatNumber(v, d.decimal);
  if (typeof v === "boolean") return v ? "1" : "0";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (s.includes(d.delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r") || s !== s.trim()) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvLine(cells: Cell[], d: ReturnType<typeof csvDialect>) {
  return `${cells.map((c) => csvCell(c, d)).join(d.delimiter)}\r\n`;
}

/** Local "YYYY-MM-DD" / "YYYY-MM-DD HH:mm" in an IANA zone (spreadsheet-friendly, DST-safe via Intl). */
export function localStamp(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = (iso: string) => {
    const p = f.formatToParts(new Date(iso));
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
    return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
  };
  return {
    date: (iso: string | null | undefined) => (iso ? parts(iso).date : null),
    time: (iso: string | null | undefined) => (iso ? parts(iso).time : null),
    dateTime: (iso: string | null | undefined) => { if (!iso) return null; const x = parts(iso); return `${x.date} ${x.time}`; },
  };
}
