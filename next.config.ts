import type { NextConfig } from "next";

/**
 * Security headers (spec §11, §103, §107).
 *
 * CSP notes
 *  - Next.js hydration injects inline scripts/styles, so 'unsafe-inline' is kept
 *    for script-src/style-src (no nonce middleware). 'unsafe-eval' is added ONLY
 *    in development (React Refresh / webpack HMR need it).
 *  - MapLibre fetches tiles/styles with fetch() and decodes them in blob: workers,
 *    so tile hosts appear in connect-src AND img-src, and blob: in worker-src.
 *  - Supabase (REST, Auth, Storage signed URLs, Realtime wss://) is derived from
 *    NEXT_PUBLIC_SUPABASE_URL at build time.
 */
const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    const wss = `${u.protocol === "http:" ? "ws:" : "wss:"}//${u.host}`;
    return [u.origin, wss];
  } catch {
    return [];
  }
}

const supabase = supabaseOrigins();
const supabaseHttp = supabase.filter((o) => o.startsWith("http"));

const TILE_HOSTS = [
  "https://server.arcgisonline.com",
  "https://*.basemaps.cartocdn.com",
  "https://tiles.openfreemap.org",
  "https://api.mapbox.com",
  "https://*.tiles.mapbox.com",
  // base maps & forest layers (Meža karte)
  "https://tile.openstreetmap.org",
  "https://tiles.globalforestwatch.org",
  "https://mapproxy.terrascope.be",
  "https://image.discomap.eea.europa.eu",
  "https://bio.discomap.eea.europa.eu",
  "https://geoserver.lvmgeo.lv",
  "https://geodpags.skogsstyrelsen.se",
  "https://geodata.naturvardsverket.se",
  "https://gis.lmi.is",
  "https://gis.is",
  "https://gis.ust.is",
];
// address / place search (OpenStreetMap Nominatim)
const GEOCODERS = ["https://nominatim.openstreetmap.org"];

const csp = [
  ["default-src", "'self'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["frame-ancestors", "'none'"],
  ["frame-src", "'none'"],
  ["form-action", "'self'"],
  ["manifest-src", "'self'"],
  ["script-src", "'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  ["style-src", "'self'", "'unsafe-inline'"],
  ["img-src", "'self'", "blob:", "data:", ...supabaseHttp, ...TILE_HOSTS],
  ["font-src", "'self'", "data:"],
  ["media-src", "'self'", "blob:", ...supabaseHttp],
  ["connect-src", "'self'", ...supabase, ...TILE_HOSTS, ...GEOCODERS, ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : [])],
  ["worker-src", "'self'", "blob:"],
  ["child-src", "'self'", "blob:"],
  ...(isDev ? [] : [["upgrade-insecure-requests"]]),
]
  .map((d) => d.join(" "))
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Training-material PDFs embed TTF fonts read from disk at runtime (see src/lib/training/pdf/document.tsx).
  // Don't evaluate every route module at boot: the PDF renderer (pdfkit) must only load on demand.
  experimental: { preloadEntriesOnStart: false },
  outputFileTracingIncludes: {
    // pdfkit loads its standard fonts with a dynamic require that file tracing can't see
    "/api/training/[id]/pdf": ["./src/lib/training/pdf/fonts/*.ttf", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be revalidated so security fixes roll out immediately.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      // versioned MapLibre worker + static boundary GeoJSON
      { source: "/maplibre/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/geo/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
