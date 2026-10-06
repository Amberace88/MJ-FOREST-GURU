/**
 * Cloudflare-only replacement for the Node builtin "module" (wrangler.jsonc → "alias").
 *
 * Why: pdfkit (used by @react-pdf/renderer for the training-material PDFs) loads the 14
 * standard PDF fonts lazily with `createRequire(import.meta.url)("#standard-fonts/<Name>")`,
 * a package.json "imports" lookup on disk. Workers have no node_modules on disk, so that
 * require fails. This shim keeps everything from node:module and only teaches the
 * required function returned by createRequire() to answer those 14 ids from data that is
 * bundled statically below (~90 KB). Every other id is delegated to the real require.
 *
 * Netlify / Node never load this file.
 */
import * as nodeModule from "node:module";
import Courier from "pdfkit/standard-fonts/Courier";
import CourierBold from "pdfkit/standard-fonts/CourierBold";
import CourierBoldOblique from "pdfkit/standard-fonts/CourierBoldOblique";
import CourierOblique from "pdfkit/standard-fonts/CourierOblique";
import Helvetica from "pdfkit/standard-fonts/Helvetica";
import HelveticaBold from "pdfkit/standard-fonts/HelveticaBold";
import HelveticaBoldOblique from "pdfkit/standard-fonts/HelveticaBoldOblique";
import HelveticaOblique from "pdfkit/standard-fonts/HelveticaOblique";
import Symbol from "pdfkit/standard-fonts/Symbol";
import TimesBold from "pdfkit/standard-fonts/TimesBold";
import TimesBoldItalic from "pdfkit/standard-fonts/TimesBoldItalic";
import TimesItalic from "pdfkit/standard-fonts/TimesItalic";
import TimesRoman from "pdfkit/standard-fonts/TimesRoman";
import ZapfDingbats from "pdfkit/standard-fonts/ZapfDingbats";

export * from "node:module";

const STANDARD_FONTS: Record<string, unknown> = {
  "#standard-fonts/Courier": Courier,
  "#standard-fonts/CourierBold": CourierBold,
  "#standard-fonts/CourierBoldOblique": CourierBoldOblique,
  "#standard-fonts/CourierOblique": CourierOblique,
  "#standard-fonts/Helvetica": Helvetica,
  "#standard-fonts/HelveticaBold": HelveticaBold,
  "#standard-fonts/HelveticaBoldOblique": HelveticaBoldOblique,
  "#standard-fonts/HelveticaOblique": HelveticaOblique,
  "#standard-fonts/Symbol": Symbol,
  "#standard-fonts/TimesBold": TimesBold,
  "#standard-fonts/TimesBoldItalic": TimesBoldItalic,
  "#standard-fonts/TimesItalic": TimesItalic,
  "#standard-fonts/TimesRoman": TimesRoman,
  "#standard-fonts/ZapfDingbats": ZapfDingbats,
};

type RequireFn = ((id: string) => unknown) & Record<string, unknown>;

export function createRequire(from: string | URL): RequireFn {
  const real = nodeModule.createRequire(from) as unknown as RequireFn;
  const wrapped = ((id: string) => (Object.prototype.hasOwnProperty.call(STANDARD_FONTS, id) ? STANDARD_FONTS[id] : real(id))) as RequireFn;
  return Object.assign(wrapped, real);
}

const defaultExport = { ...(nodeModule as unknown as { default?: object }).default, createRequire };
export default defaultExport;
