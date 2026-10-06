// OpenNext adapter configuration for Cloudflare Workers (branch `cloudflare`).
// See docs/CLOUDFLARE_MIGRATION.md. The Netlify build does not read this file.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

const config = defineCloudflareConfig({
  // Every app page is per-user and dynamic (Supabase session cookies); there is no ISR.
  // The few prerendered pages (e.g. /offline, /robots.txt) are served read-only from
  // Workers static assets, so no KV / R2 / Durable Object is needed.
  incrementalCache: staticAssetsIncrementalCache,
});

// The Next.js build OpenNext runs. Same as Netlify's `npm run build` (prebuild → MapLibre worker
// copy) preceded by scripts/cloudflare/prepare.ts (Yoga wasm, PDF fonts, static-asset _headers).
config.buildCommand = "npm run build:cf-next";

export default config;
