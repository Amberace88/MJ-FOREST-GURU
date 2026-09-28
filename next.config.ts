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
];

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
  ["connect-src", "'self'", ...supabase, ...TILE_HOSTS, ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : [])],
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
  outputFileTracingIncludes: {
    "/api/training/[id]/pdf": ["./src/lib/training/pdf/fonts/*.ttf"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be revalidated so security fixes roll out immediately.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
