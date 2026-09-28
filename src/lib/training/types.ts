/** Categories of training materials (Apmācības → Mācību materiāli). */
export const MATERIAL_CATEGORIES = ["platform", "safety", "machinery", "reporting", "emergency", "environment", "other"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Audience = role keys that must read the material. */
export type MaterialAudience = "employee" | "foreman" | "mechanic" | "manager" | "admin" | "owner";

/**
 * A built-in (standard) material shipped with the platform. Loaded into every
 * organization's library; admins can edit their copy afterwards.
 *
 * `body` uses the MJFG markdown-lite format (see ./format.ts):
 *   ## Section heading
 *   Paragraph text (consecutive lines join; a blank line ends the paragraph). **bold** works inline.
 *   - bullet item
 *   1. numbered step
 *   + must do (green check)
 *   x forbidden (red cross)
 *   !! critical callout      (optionally "!! Title: text")
 *   ! warning callout        (optionally "! Title: text")
 *   ? tip / info callout     (optionally "? Title: text")
 *   | a | b | c |            table row (first row = header)
 */
export type BuiltinMaterial = {
  key: string;                 // stable slug, e.g. "safety-lv"
  version: number;             // bump when the text changes materially
  category: MaterialCategory;
  country: "LV" | "SE" | "IS" | null; // null = all countries
  title: string;
  subtitle: string;
  summary: string;             // 1–3 sentences shown on cards
  audience: MaterialAudience[];
  requiresAck: boolean;
  readingMinutes: number;
  body: string;
};
