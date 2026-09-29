/**
 * Latvian public procurement (IUB / EIS) — every notice incl. municipalities, LVM and
 * other state companies, also below the EU thresholds (TED only has the large ones).
 * Source: IUB open data, one JSON file per publication day
 *   https://open.iub.gov.lv/data/notice/YYYY/MM/DD-MM-YYYY.json   (e-forms, since 25.10.2023)
 * Parsing is pure (unit-tested); syncing lives in tender-sync.ts.
 */
import { classifyTender, RELEVANT_SCORE, type TenderCategory } from "./tender-classify";

export type TenderStage = "planning" | "competition" | "result" | "other";

export type TenderNoticeRow = {
  id: string;
  source: "iub" | "ted";
  country: "LV" | "SE" | "IS";
  stage: TenderStage;
  notice_type: string | null;
  title: string;
  description: string | null;
  buyer_name: string | null;
  buyer_reg_no: string | null;
  buyer_city: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  region: string | null;
  cpv: string | null;
  cpv_extra: string[];
  category: TenderCategory;
  score: number;
  nature: string | null;
  procedure: string | null;
  reference: string | null;
  published_on: string | null;
  deadline: string | null;
  duration_months: number | null;
  estimated_value: number | null;
  currency: string | null;
  url: string | null;
};

export const iubDayUrl = (day: string) => {
  const [y, m, d] = day.split("-");
  return `https://open.iub.gov.lv/data/notice/${y}/${m}/${d}-${m}-${y}.json`;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : v && typeof v === "object" ? Object.values(v as Obj).map(obj) : []);

/** Offset of Europe/Riga for a given UTC instant, e.g. "+03:00". */
function rigaOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Riga", timeZoneName: "shortOffset" }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+02:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}

/** "12/10/2026" + "10:00" (Riga local) → ISO timestamp. */
export function rigaDateTime(date: string | null, time: string | null): string | null {
  const m = date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const t = time?.match(/^(\d{1,2}):(\d{2})/);
  const hh = t ? t[1].padStart(2, "0") : "23";
  const mm = t ? t[2] : "59";
  const approx = new Date(`${m[3]}-${m[2]}-${m[1]}T${hh}:${mm}:00Z`);
  if (Number.isNaN(approx.getTime())) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${hh}:${mm}:00${rigaOffset(approx)}`).toISOString();
}

const STAGES: Record<string, TenderStage> = { planning: "planning", competition: "competition", result: "result" };

/** One IUB e-form notice → row, or null when it is not relevant to forestry work. */
export function parseIubNotice(n: Obj, publishedOn: string): TenderNoticeRow | null {
  const stage = STAGES[String(n.formType ?? "")];
  if (!stage) return null; // contract execution reports, modifications …
  const title = str(n.name) ?? str(obj(n.procurementProject).description);
  if (!title) return null;
  const pp = obj(n.procurementProject);
  const description = str(pp.description) !== title ? str(pp.description) : null;
  const cpv = str(n.cpvType)?.replace(/-\d$/, "") ?? null;
  const cpvExtra = (Array.isArray(n.additionalCpvType) ? n.additionalCpvType : []).map((c) => String(c).replace(/-\d$/, "")).filter(Boolean);
  const { score, category } = classifyTender({ title, description, cpv, cpvExtra });
  if (score < RELEVANT_SCORE) return null;

  const org = obj(n.organizationData);
  const contact = obj(org.defaultContactPoint);
  const tp = obj(n.tenderingProcess);
  const lots = list(n.lots);
  const deadlines = lots
    .map((l) => { const p = obj(l.tenderingProcess); return rigaDateTime(str(p.deadlineReceiptTendersEndDate), str(p.deadlineReceiptTendersEndTime)); })
    .filter((d): d is string => Boolean(d)).sort();
  const values = lots.map((l) => Number(str(obj(l.additionalInformation).estimatedValue) ?? NaN)).filter((v) => Number.isFinite(v) && v > 0);
  const durations = lots.map((l) => Number(obj(l.duration).durationPeriod)).filter((v) => Number.isFinite(v) && v > 0);
  const url = str(tp.documentsURL) ?? str(obj(n.tenderingTerms).submissionURL) ?? str(org.websiteURIClient);
  const eisId = url?.match(/Procurement\/(\d+)/)?.[1];
  const key = eisId ?? str(pp.procurementIdentifier) ?? str(n.identifier) ?? title;

  return {
    id: `iub:${key}:${stage}`,
    source: "iub",
    country: "LV",
    stage,
    notice_type: str(n.noticeType),
    title: title.slice(0, 500),
    description: description?.slice(0, 2000) ?? null,
    buyer_name: str(org.name),
    buyer_reg_no: str(org.identifier),
    buyer_city: str(org.city),
    buyer_email: str(contact.electronicMail) ?? str(org.electronicMail),
    buyer_phone: str(contact.telephone),
    region: str(org.nutsCode),
    cpv,
    cpv_extra: cpvExtra,
    category,
    score,
    nature: str(pp.mainNatureType) ?? str(n.mainNatureType),
    procedure: str(tp.procedureType),
    reference: str(pp.procurementIdentifier),
    published_on: publishedOn,
    deadline: deadlines[0] ?? null,
    duration_months: durations.length ? Math.max(...durations) : null,
    estimated_value: values.length ? values.reduce((a, b) => a + b, 0) : null,
    currency: values.length ? "EUR" : null,
    url,
  };
}

/** Parse one day file; later versions of the same notice replace earlier ones. */
export function parseIubDay(json: unknown, publishedOn: string): TenderNoticeRow[] {
  const byId = new Map<string, TenderNoticeRow>();
  for (const n of Array.isArray(json) ? json : []) {
    const row = parseIubNotice(obj(n), publishedOn);
    if (row) byId.set(row.id, row);
  }
  return [...byId.values()];
}
