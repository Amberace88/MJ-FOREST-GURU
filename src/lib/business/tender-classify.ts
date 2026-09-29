/**
 * Forestry relevance of a public procurement notice (pure, shared by IUB + TED).
 * Score ≥ RELEVANT_SCORE → kept. Category drives the filter chips in the UI.
 */
export type TenderCategory = "harvesting" | "trees" | "planting" | "timber" | "other";
export const RELEVANT_SCORE = 3;

export const TENDER_CATEGORY_LV: Record<TenderCategory, string> = {
  harvesting: "Mežizstrāde",
  trees: "Koku zāģēšana, apaugums",
  planting: "Stādīšana, kopšana",
  timber: "Kokmateriāli, kurināmais",
  other: "Cits",
};

// CPV prefix → [category, weight]; longest prefix wins
const CPV_RULES: [string, TenderCategory, number][] = [
  ["7720", "harvesting", 6], ["7721", "harvesting", 6], ["77211", "harvesting", 6],
  ["772113", "trees", 6], ["772114", "trees", 6], ["772115", "trees", 6], ["772116", "planting", 6],
  ["7722", "planting", 6], ["7723", "planting", 6],
  ["7734", "trees", 5], ["7731", "trees", 3], ["77312", "trees", 3],
  ["0340", "timber", 4], ["0341", "timber", 4], ["03413", "timber", 4], ["091114", "timber", 2],
];

// keyword stems (word start) → [category, weight]
const KEYWORDS: [RegExp, TenderCategory, number][] = [
  [/mežizstrād/, "harvesting", 6],
  [/cirsm/, "harvesting", 5],
  [/(kail|kopšanas|galven\S* )?cirt(e|es|ēm|i)\b/, "harvesting", 3],
  [/ciršan/, "trees", 4],
  [/bīstam\S* koku|koku (zāģ|izzāģ|nozāģ|ciršan|izciršan|kopšan|vainag)/, "trees", 5],
  [/apaugum|krūmāj|krūmu (ciršan|izciršan|pļaušan|tīrīšan)/, "trees", 4],
  [/jaunaudž/, "planting", 5],
  [/meža (stād|atjaunoš|kopšan|apsaimniek|ieaudzēš)|mežsaimniec|meža infrastruktūr/, "planting", 4],
  [/kokmateriāl|apaļkok|zāģbaļķ|papīrmalk/, "timber", 4],
  [/malk|šķeld|biomas/, "timber", 3],
  [/celmu (rauš|frēz|izrauš)/, "trees", 3],
  // Swedish / English (TED titles)
  [/avverkning|skogsvård|gallring|röjning|trädfällning|skogsbruk/, "harvesting", 5],
  [/logging|forestry|tree (felling|cutting|pruning)|timber harvest/, "harvesting", 5],
];

// not our work: pellets, furniture, paper …
const NEGATIVE: RegExp[] = [/granul/, /mēbel/, /papīra (piegād|iegād)/, /apdrošināš/];

const START = "(?:^|[^\\p{L}])";

export function classifyTender(input: { title: string; description?: string | null; cpv?: string | null; cpvExtra?: string[] }): { score: number; category: TenderCategory } {
  const scores: Record<TenderCategory, number> = { harvesting: 0, trees: 0, planting: 0, timber: 0, other: 0 };
  const codes = [input.cpv, ...(input.cpvExtra ?? [])].filter(Boolean).map((c) => String(c).replace(/\D/g, ""));
  codes.forEach((code, i) => {
    let best: [string, TenderCategory, number] | null = null;
    for (const r of CPV_RULES) if (code.startsWith(r[0]) && (!best || r[0].length > best[0].length)) best = r;
    if (best) scores[best[1]] += i === 0 ? best[2] : Math.ceil(best[2] / 2);
  });
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
  for (const [re, cat, w] of KEYWORDS) {
    if (new RegExp(START + re.source, "u").test(text)) scores[cat] += w;
  }
  if (NEGATIVE.some((re) => new RegExp(START + re.source, "u").test(text))) scores.timber = Math.min(scores.timber, 0);
  let category: TenderCategory = "other";
  let top = 0;
  for (const c of ["harvesting", "trees", "planting", "timber"] as TenderCategory[]) if (scores[c] > top) { top = scores[c]; category = c; }
  const score = scores.harvesting + scores.trees + scores.planting + scores.timber;
  return { score, category };
}
