/**
 * Environment access. Public values are inlined by Next.js at build time;
 * server-only secrets live in src/lib/env.server.ts and are never imported
 * into client components.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey);
}

/**
 * Absolute base URL for auth redirects. Never hard-coded to localhost:
 * NEXT_PUBLIC_APP_URL (production: https://app.mjforestguru.com) wins,
 * then Vercel preview URL, then the request origin passed by the caller.
 */
export function appBaseUrl(requestOrigin?: string | null): string {
  if (publicEnv.appUrl) return publicEnv.appUrl;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return (requestOrigin ?? "").replace(/\/$/, "");
}
