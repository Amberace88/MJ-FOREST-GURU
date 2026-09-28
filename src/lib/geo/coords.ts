/**
 * Coordinate parsing & formatting for the maps.
 * Accepts what field people actually type or copy:
 *   56.9496, 24.1052            (lat, lng – decimal, comma or space)
 *   24.1052 56.9496             (lng lat – swapped automatically when obvious)
 *   56°56'58.6"N 24°6'18.7"E    (DMS, also with spaces / ′ ″ / N-S-E-W letters)
 *   56 56.977N 24 6.312E        (degrees + decimal minutes)
 *   X 312345 Y 506789  | 506789, 312345   (LKS-92 TM, EPSG:3059 – Latvian maps)
 *   6580822, 674032             (SWEREF 99 TM, EPSG:3006 – Swedish maps)
 */

export type LngLat = { lng: number; lat: number };
export type ParsedCoords = LngLat & { system: "wgs84" | "lks92" | "sweref99" };

// ------------------------------------------------------------ Transverse Mercator (GRS80)
type TM = { lon0: number; k0: number; fe: number; fn: number };
const LKS92: TM = { lon0: 24, k0: 0.9996, fe: 500000, fn: -6000000 };
const SWEREF99: TM = { lon0: 15, k0: 0.9996, fe: 500000, fn: 0 };

const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function meridianArc(phi: number) {
  const e4 = E2 * E2, e6 = e4 * E2;
  return A * ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi
    - ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi)
    + ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi)
    - ((35 * e6) / 3072) * Math.sin(6 * phi));
}

/** WGS84/ETRS89 → TM grid (northing, easting). */
export function toTM({ lat, lng }: LngLat, p: TM): { n: number; e: number } {
  const phi = rad(lat), lam = rad(lng - p.lon0);
  const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2, C = EP2 * Math.cos(phi) ** 2, Aa = Math.cos(phi) * lam;
  const M = meridianArc(phi);
  const e = p.fe + p.k0 * N * (Aa + ((1 - T + C) * Aa ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5) / 120);
  const n = p.fn + p.k0 * (M + N * Math.tan(phi) * (Aa * Aa / 2 + ((5 - T + 9 * C + 4 * C * C) * Aa ** 4) / 24
    + ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6) / 720));
  return { n, e };
}

/** TM grid → WGS84/ETRS89. */
export function fromTM(n: number, e: number, p: TM): LngLat {
  const M = (n - p.fn) / p.k0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2, C1 = EP2 * Math.cos(phi1) ** 2;
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = (e - p.fe) / (N1 * p.k0);
  const lat = phi1 - ((N1 * Math.tan(phi1)) / R1) * (D * D / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lng = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) / Math.cos(phi1);
  return { lat: deg(lat), lng: p.lon0 + deg(lng) };
}

export const toLKS92 = (p: LngLat) => toTM(p, LKS92);
export const toSWEREF99 = (p: LngLat) => toTM(p, SWEREF99);

// ------------------------------------------------------------ parsing
const inArea = (p: LngLat) => p.lat >= 54 && p.lat <= 67.5 && p.lng >= -25 && p.lng <= 29;
const valid = (p: LngLat) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function dmsParts(s: string): { v: number; hemi: string | null }[] {
  // e.g. 56°56'58.6"N  |  56 56.977 N  |  N56.9496
  const re = /([NSEWZDAR])?\s*(-?\d+(?:[.,]\d+)?)\s*[°º˚d]?\s*(?:(\d+(?:[.,]\d+)?)\s*['′’m]?\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:["″”]|''|s)?\s*)?([NSEWZDAR])?/gi;
  const out: { v: number; hemi: string | null }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) && out.length < 2) {
    if (!m[2]) { if (m[0] === "") re.lastIndex++; continue; }
    const d = Number(m[2].replace(",", ".")), mi = m[3] ? Number(m[3].replace(",", ".")) : 0, se = m[4] ? Number(m[4].replace(",", ".")) : 0;
    const v = Math.sign(d || 1) * (Math.abs(d) + mi / 60 + se / 3600);
    out.push({ v, hemi: (m[1] || m[5] || "").toUpperCase() || null });
  }
  return out;
}

/** Returns WGS84 position or null when the text is not a coordinate. */
export function parseCoordinates(input: string): ParsedCoords | null {
  const s = input.trim().replace(/\s+/g, " ");
  if (!s || /\p{L}{3,}/u.test(s.replace(/lks|sweref|wgs/gi, ""))) return null; // a word → address, not coordinates

  // plain two numbers
  const nums = s.match(/-?\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(",", "."))) ?? [];
  const hasDms = /[°º˚'′"″NSEW]/i.test(s.replace(/lks|sweref|wgs/gi, ""));

  if (!hasDms && nums.length === 2) {
    const [a, b] = nums;
    // projected grids (metres)
    if (Math.abs(a) > 1000 && Math.abs(b) > 1000) {
      const big = Math.max(a, b), small = Math.min(a, b);
      if (/sweref/i.test(s) || big > 6_100_000) { // SWEREF 99 TM: N ≈ 6.1–7.7 M
        const p = fromTM(big, small, SWEREF99);
        return valid(p) ? { ...p, system: "sweref99" } : null;
      }
      // LKS-92: X (northing) ≈ 160k–450k, Y (easting) ≈ 300k–770k. Latvian maps often print X first.
      const cands = [fromTM(a, b, LKS92), fromTM(b, a, LKS92)].filter((p) => p.lat > 55.5 && p.lat < 58.2 && p.lng > 20.8 && p.lng < 28.4);
      return cands[0] ? { ...cands[0], system: "lks92" } : null;
    }
    let p: LngLat = { lat: a, lng: b };
    if (!inArea(p) && inArea({ lat: b, lng: a })) p = { lat: b, lng: a }; // "lng, lat" order
    return valid(p) ? { ...p, system: "wgs84" } : null;
  }

  if (hasDms) {
    const parts = dmsParts(s);
    if (parts.length !== 2) return null;
    let lat: number | null = null, lng: number | null = null;
    for (const p of parts) {
      const h = p.hemi;
      if (h === "N" || h === "Z") lat = Math.abs(p.v);          // Z = ziemeļi
      else if (h === "S" || h === "D") lat = -Math.abs(p.v);    // D = dienvidi
      else if (h === "E" || h === "A") lng = Math.abs(p.v);     // A = austrumi
      else if (h === "W" || h === "R") lng = -Math.abs(p.v);    // R = rietumi
      else if (lat == null) lat = p.v; else lng = p.v;
    }
    if (lat == null || lng == null) return null;
    const p = { lat, lng };
    return valid(p) ? { ...p, system: "wgs84" } : null;
  }
  return null;
}

export function fmtLatLng({ lat, lng }: LngLat, digits = 5) {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

export function fmtDMS({ lat, lng }: LngLat) {
  const one = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = (mf - m) * 60;
    return `${d}°${String(m).padStart(2, "0")}′${sec.toFixed(1).padStart(4, "0")}″${v >= 0 ? pos : neg}`;
  };
  return `${one(lat, "N", "S")} ${one(lng, "E", "W")}`;
}

/** Local national grid for display, if the point is in LV or SE. */
export function localGrid(p: LngLat): { label: string; text: string } | null {
  if (p.lat > 55.5 && p.lat < 58.2 && p.lng > 20.8 && p.lng < 28.4) {
    const g = toLKS92(p);
    return { label: "LKS-92", text: `X ${Math.round(g.n)}  Y ${Math.round(g.e)}` };
  }
  if (p.lat > 55 && p.lat < 69.2 && p.lng > 10.5 && p.lng < 24.2) {
    const g = toSWEREF99(p);
    return { label: "SWEREF 99 TM", text: `N ${Math.round(g.n)}  E ${Math.round(g.e)}` };
  }
  return null;
}
