/**
 * Renders every built-in training material to ./out/training-pdfs/<key>.pdf
 * using the same document component as /api/training/[id]/pdf.
 *
 *   npx tsx scripts/export-training-pdfs.tsx
 *
 * (No JSX needed here: renderMaterialPdf wraps the document component.)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";

// tsx runs this file as CommonJS; @react-pdf/hyphenate only declares an "import" export
// condition, so map its language subpaths to the files directly (Next's bundler does not need this).
type Resolve = (request: string, ...rest: unknown[]) => string;
const mod = Module as unknown as { _resolveFilename: Resolve };
const originalResolve = mod._resolveFilename;
mod._resolveFilename = function (request: string, ...rest: unknown[]) {
  const m = /^@react-pdf\/hyphenate\/([a-z-]+)$/.exec(request);
  if (m) return path.resolve(process.cwd(), "node_modules", "@react-pdf", "hyphenate", "lib", `${m[1]}.js`);
  return originalResolve.call(this, request, ...rest);
};

const COUNTRY: Record<string, string> = { LV: "Latvija", SE: "Zviedrija", IS: "Islande" };

async function main() {
  // loaded after the resolver patch above
  const { BUILTIN_MATERIALS } = await import("../src/lib/training/library");
  const { renderMaterialPdf } = await import("../src/lib/training/pdf/document");

  const outDir = path.resolve(process.cwd(), "out", "training-pdfs");
  mkdirSync(outDir, { recursive: true });
  for (const b of BUILTIN_MATERIALS) {
    const buf = await renderMaterialPdf({
      title: b.title, subtitle: b.subtitle, summary: b.summary, category: b.category, version: b.version, date: new Date(),
      country: b.country ? COUNTRY[b.country] ?? b.country : null, audience: [...b.audience], readingMinutes: b.readingMinutes,
      requiresAck: b.requiresAck, body: b.body,
    });
    const file = path.join(outDir, `${b.key}.pdf`);
    writeFileSync(file, buf);
    console.log(`✓ ${path.relative(process.cwd(), file)}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
