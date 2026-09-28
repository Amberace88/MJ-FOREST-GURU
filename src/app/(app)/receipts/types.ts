/** Shared (client + server) receipt types. */
export const CURRENCIES = ["EUR", "SEK", "ISK"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Values proposed by an OCR provider. They are ONLY used to prefill the
 * confirmation form — never written to the receipt columns without the user
 * confirming them (receipts.ocr_confirmed).
 */
export type ReceiptOcr = {
  merchant?: string;
  date?: string;
  total?: number;
  vat?: number;
  currency?: Currency;
};

export type ReceiptOption = { value: string; label: string };

/** Minimal option set passed from server pages into receipt/expense forms. */
export type ReceiptFormOptions = {
  projects: ReceiptOption[];
  machines: ReceiptOption[];
  fuelTypes: ReceiptOption[];
  /** project id → default currency (from the project's country) */
  projectCurrency: Record<string, string>;
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** Reads a stored ocr_raw JSON value defensively (it is untrusted provider output). */
export function parseOcr(raw: unknown): ReceiptOcr | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: ReceiptOcr = {};
  if (typeof r.merchant === "string" && r.merchant.trim()) out.merchant = r.merchant.trim().slice(0, 200);
  if (typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) out.date = r.date;
  const total = typeof r.total === "number" ? r.total : typeof r.total === "string" ? Number(r.total) : NaN;
  if (Number.isFinite(total) && total >= 0) out.total = Math.round(total * 100) / 100;
  const vat = typeof r.vat === "number" ? r.vat : typeof r.vat === "string" ? Number(r.vat) : NaN;
  if (Number.isFinite(vat) && vat >= 0) out.vat = Math.round(vat * 100) / 100;
  if (isCurrency(r.currency)) out.currency = r.currency;
  return Object.keys(out).length ? out : null;
}
