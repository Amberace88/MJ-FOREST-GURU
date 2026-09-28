// MapLibre v6 resolves its worker relative to import.meta.url, which does not exist after
// bundling. Ship the worker (+ its shared chunk) as static files and point MapLibre at them.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const src = join(process.cwd(), "node_modules/maplibre-gl/dist");
const { version } = JSON.parse(readFileSync(join(process.cwd(), "node_modules/maplibre-gl/package.json"), "utf8"));
const out = join(process.cwd(), "public/maplibre", version);
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(src, f), join(out, f));
console.log(`maplibre worker ${version} → public/maplibre/${version}`);
