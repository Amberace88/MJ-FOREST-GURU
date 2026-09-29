/** Forest map opportunities (sales pipeline) — shared constants & labels. */
export const LEAD_STATUSES = ["new", "contacted", "survey", "offer", "won", "lost"] as const;
export const LEAD_SOURCES = ["felling_notice", "tender", "owner", "buyer", "referral", "map", "other"] as const;
export const LEAD_WORK_TYPES = ["final_felling", "thinning", "planting", "young_stand", "road", "other"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadWorkType = (typeof LEAD_WORK_TYPES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Jauna", contacted: "Sazināts", survey: "Apsekošana", offer: "Piedāvājums", won: "Iegūta", lost: "Zaudēta",
};
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "#6aa7d8", contacted: "#9b8cd9", survey: "#e3b448", offer: "#e08a3c", won: "#5fae6e", lost: "#737c75",
};
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  felling_notice: "Ciršanas paziņojums", tender: "Iepirkums / konkurss", owner: "Meža īpašnieks", buyer: "Kokmateriālu pircējs",
  referral: "Ieteikums", map: "Atrasts kartē", other: "Cits",
};
export const LEAD_WORK_LABEL: Record<LeadWorkType, string> = {
  final_felling: "Kailcirte / galvenā cirte", thinning: "Krājas kopšana", planting: "Stādīšana", young_stand: "Jaunaudžu kopšana", road: "Meža ceļš", other: "Cits",
};

/** Pipeline weight used for the forecast (value × probability; default by stage). */
export const STAGE_PROBABILITY: Record<LeadStatus, number> = { new: 10, contacted: 20, survey: 40, offer: 60, won: 100, lost: 0 };

/** Whole-unit money for opportunity cards (shared by server pages and client components). */
export function fmtMoney(v: number | null | undefined, cur = "EUR") {
  if (v == null) return "—";
  try { return new Intl.NumberFormat("lv-LV", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v); } catch { return `${Math.round(v)} ${cur}`; }
}
