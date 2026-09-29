import "server-only";
import { logServerError } from "@/lib/errors";

/**
 * New felling notifications in Sweden (Skogsstyrelsen avverkningsanmälningar, CC0).
 * "NyAvverkningsanmalan" = filed within the last 42 days — the owner will need a contractor soon.
 */
export const SE_COUNTIES: { code: string; name: string }[] = [
  { code: "01", name: "Stockholm" }, { code: "03", name: "Uppsala" }, { code: "04", name: "Södermanland" },
  { code: "05", name: "Östergötland" }, { code: "06", name: "Jönköping" }, { code: "07", name: "Kronoberg" },
  { code: "08", name: "Kalmar" }, { code: "09", name: "Gotland" }, { code: "10", name: "Blekinge" },
  { code: "12", name: "Skåne" }, { code: "13", name: "Halland" }, { code: "14", name: "Västra Götaland" },
  { code: "17", name: "Värmland" }, { code: "18", name: "Örebro" }, { code: "19", name: "Västmanland" },
  { code: "20", name: "Dalarna" }, { code: "21", name: "Gävleborg" }, { code: "22", name: "Västernorrland" },
  { code: "23", name: "Jämtland" }, { code: "24", name: "Västerbotten" }, { code: "25", name: "Norrbotten" },
];

export const FELLING_TYPE_LV: Record<string, string> = {
  "Föryngringsavverkning": "Galvenā cirte (atjaunošanas cirte)",
  "Avverkning för annat ändamål": "Cirte citam mērķim (ceļš, būvniecība u.c.)",
  "Avverkning för att bevara och utveckla /försöksver": "Dabas saglabāšanas / izmēģinājuma cirte",
};
export const FOREST_TYPE_LV: Record<string, string> = {
  "Normal skog": "Parasts mežs", "Ädellövskog": "Cēlo lapu koku mežs", "Fjällnära skog": "Kalnu tuvais mežs",
};

export type FellingNotice = {
  id: string; county: string; municipality: string; type: string; typeLv: string; forestType: string; forestTypeLv: string;
  filed: string; ha: number; status: string; lat: number | null; lng: number | null;
};

const BASE = "https://geodpags.skogsstyrelsen.se/arcgis/rest/services/Geodataportal/GeodataportalVisaAvverkningsanmalan/MapServer/0";
const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

function centroid(rings: number[][][] | undefined): [number, number] | null {
  const ring = rings?.[0];
  if (!ring?.length) return null;
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
}

export async function fetchFellingNotices(opts: { counties?: string[]; minHa?: number; type?: string; limit?: number } = {}): Promise<{ items: FellingNotice[]; total: number; error?: string }> {
  const parts = ["AvverkningsanmalanKlass='NyAvverkningsanmalan'"];
  if (opts.minHa) parts.push(`AnmaldHa>=${Number(opts.minHa)}`);
  const counties = (opts.counties ?? []).filter((c) => /^\d{2}$/.test(c));
  if (counties.length) parts.push(`Lannr IN (${counties.map((c) => `'${c}'`).join(",")})`);
  if (opts.type && FELLING_TYPE_LV[opts.type]) parts.push(`Avverktyp='${opts.type.replace(/'/g, "''")}'`);
  const where = parts.join(" AND ");
  const qs = new URLSearchParams({
    where, outFields: "Beteckn,Lan,Kommun,Avverktyp,Skogstyp,Inkomdatum,AnmaldHa,ArendeStatus",
    returnGeometry: "true", outSR: "4326", maxAllowableOffset: "0.002", geometryPrecision: "5",
    orderByFields: "Inkomdatum DESC", resultRecordCount: String(opts.limit ?? 300), f: "json",
  });
  try {
    const [res, cnt] = await Promise.all([
      fetch(`${BASE}/query?${qs}`, { next: { revalidate: 60 * 60 * 3 } }),
      fetch(`${BASE}/query?${new URLSearchParams({ where, returnCountOnly: "true", f: "json" })}`, { next: { revalidate: 60 * 60 * 3 } }),
    ]);
    if (!res.ok) throw new Error(`Skogsstyrelsen ${res.status}`);
    const json = (await res.json()) as { features?: { attributes: Record<string, unknown>; geometry?: { rings?: number[][][] } }[]; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    const total = ((await cnt.json().catch(() => ({}))) as { count?: number }).count ?? 0;
    const items = (json.features ?? []).map((f): FellingNotice => {
      const a = f.attributes;
      const c = centroid(f.geometry?.rings);
      const type = String(a.Avverktyp ?? "");
      return {
        id: String(a.Beteckn ?? ""), county: title(String(a.Lan ?? "")), municipality: title(String(a.Kommun ?? "")),
        type, typeLv: FELLING_TYPE_LV[type] ?? type, forestType: String(a.Skogstyp ?? ""), forestTypeLv: FOREST_TYPE_LV[String(a.Skogstyp ?? "")] ?? String(a.Skogstyp ?? ""),
        filed: a.Inkomdatum ? new Date(Number(a.Inkomdatum)).toISOString().slice(0, 10) : "",
        ha: Number(a.AnmaldHa ?? 0), status: String(a.ArendeStatus ?? ""),
        lng: c ? c[0] : null, lat: c ? c[1] : null,
      };
    });
    return { items, total };
  } catch (e) {
    logServerError("business.skogsstyrelsen", e);
    return { items: [], total: 0, error: "Skogsstyrelsen dati nav pieejami" };
  }
}
