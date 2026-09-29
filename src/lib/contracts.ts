/** Contracts register — labels and pure helpers shared by server pages and client dialogs. */

export const CONTRACT_STATUSES = ["draft", "negotiation", "signed", "active", "completed", "terminated", "expired"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Melnraksts", negotiation: "Sarunās", signed: "Parakstīts", active: "Izpildē", completed: "Pabeigts", terminated: "Lauzts", expired: "Beidzies",
};
export const CONTRACT_STATUS_TONE: Record<ContractStatus, "neutral" | "info" | "amber" | "ok" | "off" | "crit"> = {
  draft: "neutral", negotiation: "info", signed: "amber", active: "ok", completed: "off", terminated: "crit", expired: "off",
};
/** Status groups used by the list filter chips. */
export const CONTRACT_GROUPS = {
  current: ["signed", "active"],
  pipeline: ["draft", "negotiation"],
  closed: ["completed", "terminated", "expired"],
} as const satisfies Record<string, readonly ContractStatus[]>;

export const WORK_TYPES = ["harvesting", "thinning", "forwarding", "clearing", "planting", "young_stand", "road", "transport", "timber_sale", "other"] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  harvesting: "Mežizstrāde (galvenā cirte)", thinning: "Krājas kopšanas cirte", forwarding: "Pievešana", clearing: "Apauguma / bīstamo koku zāģēšana",
  planting: "Stādīšana, meža atjaunošana", young_stand: "Jaunaudžu kopšana", road: "Meža ceļi, grāvji", transport: "Kokvedēju transports",
  timber_sale: "Kokmateriālu pārdošana", other: "Cits",
};

export const CONTRACT_SOURCES = ["tender", "private", "repeat", "subcontract", "other"] as const;
export const CONTRACT_SOURCE_LABEL: Record<(typeof CONTRACT_SOURCES)[number], string> = {
  tender: "Publiskais iepirkums", private: "Privāts pasūtītājs", repeat: "Atkārtots klients", subcontract: "Apakšuzņēmums", other: "Cits",
};

export const PRICING_MODELS = ["per_m3", "per_ha", "per_hour", "per_tonne", "fixed", "other"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];
export const PRICING_LABEL: Record<PricingModel, string> = {
  per_m3: "par m³", per_ha: "par ha", per_hour: "par stundu", per_tonne: "par tonnu", fixed: "fiksēta summa", other: "cits",
};

export const MILESTONE_KINDS = ["deadline", "delivery", "invoice", "payment", "inspection", "other"] as const;
export const MILESTONE_KIND_LABEL: Record<(typeof MILESTONE_KINDS)[number], string> = {
  deadline: "Termiņš", delivery: "Nodošana", invoice: "Rēķins", payment: "Maksājums", inspection: "Pārbaude", other: "Cits",
};

export const CURRENCIES = ["EUR", "SEK", "ISK", "NOK", "USD"] as const;

export type ContractValueInput = {
  total_value: number | null; unit_price: number | null; volume_m3: number | null; area_ha: number | null; pricing_model: string;
};

/** Agreed value; when only a unit price is known, estimate it from volume / area. */
export function contractValue(c: ContractValueInput): { value: number | null; estimated: boolean } {
  if (c.total_value != null) return { value: Number(c.total_value), estimated: false };
  if (c.unit_price == null) return { value: null, estimated: false };
  if (c.pricing_model === "per_m3" && c.volume_m3) return { value: Math.round(Number(c.unit_price) * Number(c.volume_m3) * 100) / 100, estimated: true };
  if (c.pricing_model === "per_ha" && c.area_ha) return { value: Math.round(Number(c.unit_price) * Number(c.area_ha) * 100) / 100, estimated: true };
  return { value: null, estimated: false };
}

/** 0–100 share of the contract period that has elapsed (null when the period is unknown). */
export function timeProgress(start: string | null, end: string | null, today: string): number | null {
  if (!start || !end) return null;
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T23:59:59Z`);
  const t = Date.parse(`${today}T12:00:00Z`);
  if (!(e > s)) return null;
  return Math.max(0, Math.min(100, Math.round(((t - s) / (e - s)) * 100)));
}

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export type DueItem = { contractId: string; contractTitle: string; label: string; date: string; kind: "end" | "notice" | "milestone"; amount?: number | null };

/** Upcoming dates across contracts: end dates, notice (extension / termination) dates, open milestones. */
export function upcomingDates(
  contracts: { id: string; title: string; status: string; end_date: string | null; notice_date: string | null }[],
  milestones: { contract_id: string; title: string; kind: string; due_date: string | null; done_at: string | null; amount: number | null }[],
  today: string,
  horizonDays = 60,
): DueItem[] {
  const open = new Map(contracts.filter((c) => ["draft", "negotiation", "signed", "active"].includes(c.status)).map((c) => [c.id, c]));
  const items: DueItem[] = [];
  for (const c of open.values()) {
    if (c.end_date && daysBetween(today, c.end_date) <= horizonDays) items.push({ contractId: c.id, contractTitle: c.title, label: "Līguma beigas", date: c.end_date, kind: "end" });
    if (c.notice_date && daysBetween(today, c.notice_date) <= horizonDays) items.push({ contractId: c.id, contractTitle: c.title, label: "Pagarināt / uzteikt līdz", date: c.notice_date, kind: "notice" });
  }
  for (const m of milestones) {
    const c = open.get(m.contract_id);
    if (!c || m.done_at || !m.due_date || daysBetween(today, m.due_date) > horizonDays) continue;
    items.push({ contractId: c.id, contractTitle: c.title, label: `${MILESTONE_KIND_LABEL[m.kind as keyof typeof MILESTONE_KIND_LABEL] ?? m.kind}: ${m.title}`, date: m.due_date, kind: "milestone", amount: m.amount });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
