import "server-only";
import { logServerError } from "@/lib/errors";

/**
 * Public procurement for forestry work from TED (Tenders Electronic Daily, EU/EEA official
 * journal — covers Latvia, Sweden and Iceland above the EU thresholds). Open API, no key.
 * https://docs.ted.europa.eu/api/latest/search.html
 */
export const FORESTRY_CPV = [
  "77200000", "77210000", "77211000", "77211100", "77211200", "77211300", "77211400", "77211500", "77211600",
  "77220000", "77230000", "77231000", "77231100", "77231200", "77231300", "77231400", "77231500", "77231600",
  "77231700", "77231800", "77231900", "77340000",
] as const;

export type TenderCountry = "LV" | "SE" | "IS";
const ISO3: Record<TenderCountry, string> = { LV: "LVA", SE: "SWE", IS: "ISL" };

export type Tender = {
  id: string;             // publication number, e.g. "667756-2026"
  title: string;
  buyer: string;
  countries: TenderCountry[];
  published: string;      // YYYY-MM-DD
  deadline: string | null;
  value: number | null;
  currency: string | null;
  kind: "notice" | "prior" | "award" | "other";
  url: string;
};

const pickLang = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return pickLang(v[0]);
  const o = v as Record<string, unknown>;
  return pickLang(o.lav ?? o.eng ?? o.swe ?? o.isl ?? Object.values(o)[0]);
};
const day = (s: unknown) => (typeof s === "string" ? s.slice(0, 10) : null);

function kindOf(t: string): Tender["kind"] {
  if (t.startsWith("cn")) return "notice";
  if (t.startsWith("pin")) return "prior";
  if (t.startsWith("can")) return "award";
  return "other";
}

export async function fetchTenders(opts: { countries?: TenderCountry[]; sinceDays?: number; limit?: number } = {}): Promise<{ items: Tender[]; total: number; error?: string }> {
  const countries = opts.countries?.length ? opts.countries : (["LV", "SE", "IS"] as TenderCountry[]);
  const since = new Date(Date.now() - (opts.sinceDays ?? 180) * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const query = `classification-cpv IN (${FORESTRY_CPV.join(" ")}) AND place-of-performance IN (${countries.map((c) => ISO3[c]).join(" ")}) AND publication-date>=${since} SORT BY publication-date DESC`;
  try {
    const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query, scope: "ALL", page: 1, limit: opts.limit ?? 100, paginationMode: "PAGE_NUMBER",
        fields: ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot",
          "place-of-performance", "notice-type", "estimated-value-proc", "estimated-value-cur-proc"],
      }),
      next: { revalidate: 60 * 60 * 3 }, // 3 h
    });
    if (!res.ok) throw new Error(`TED ${res.status}`);
    const json = (await res.json()) as { notices?: Record<string, unknown>[]; totalNoticeCount?: number };
    const today = new Date().toISOString().slice(0, 10);
    const items = (json.notices ?? []).map((n): Tender => {
      const pub = String(n["publication-number"]);
      const places = (n["place-of-performance"] as string[] | undefined) ?? [];
      const cs = (Object.keys(ISO3) as TenderCountry[]).filter((c) => places.some((p) => p === ISO3[c] || p.startsWith(c)));
      const deadlines = ((n["deadline-receipt-tender-date-lot"] as string[] | undefined) ?? []).map((d) => d.slice(0, 10)).sort();
      const future = deadlines.filter((d) => d >= today);
      const title = pickLang(n["notice-title"]).replace(/^[^–-]+[–-]\s*/, "").trim(); // drop "Latvija – " prefix
      return {
        id: pub, title: title || pub, buyer: pickLang(n["buyer-name"]) || "—", countries: cs,
        published: day(n["publication-date"]) ?? "", deadline: future[0] ?? deadlines.at(-1) ?? null,
        value: n["estimated-value-proc"] != null ? Number(n["estimated-value-proc"]) : null,
        currency: (n["estimated-value-cur-proc"] as string | undefined) ?? null,
        kind: kindOf(String(n["notice-type"] ?? "")), url: `https://ted.europa.eu/lv/notice/-/detail/${pub}`,
      };
    });
    return { items, total: json.totalNoticeCount ?? items.length };
  } catch (e) {
    logServerError("business.ted", e);
    return { items: [], total: 0, error: "TED nav pieejams" };
  }
}
