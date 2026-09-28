import { MATERIAL_CATEGORIES, type MaterialAudience, type MaterialCategory } from "./types";

/** Visual identity per category — shared by the web UI (accent) and the PDF cover. */
export const CATEGORY_META: Record<MaterialCategory, { color: string; order: number }> = {
  platform: { color: "#4f86b8", order: 1 },
  reporting: { color: "#2f8a6b", order: 2 },
  safety: { color: "#d9822b", order: 3 },
  machinery: { color: "#a47444", order: 4 },
  emergency: { color: "#d2453b", order: 5 },
  environment: { color: "#5d8f3f", order: 6 },
  other: { color: "#7b857d", order: 7 },
};

export const AUDIENCE_KEYS: readonly MaterialAudience[] = ["employee", "foreman", "mechanic", "manager", "admin", "owner"];

export function isCategory(v: unknown): v is MaterialCategory {
  return typeof v === "string" && (MATERIAL_CATEGORIES as readonly string[]).includes(v);
}

export function sortByCategory<T extends { category: string; title: string }>(rows: T[]): T[] {
  const ord = (c: string) => (isCategory(c) ? CATEGORY_META[c].order : 99);
  return [...rows].sort((a, b) => ord(a.category) - ord(b.category) || a.title.localeCompare(b.title, "lv"));
}

/** Does an employee with `roles` in `countryId` belong to a material's audience? Empty audience = everyone. */
export function inAudience(
  material: { audience: readonly string[] | null; country_id: string | null },
  person: { roles: readonly string[]; country_id: string | null },
): boolean {
  if (material.country_id && person.country_id && material.country_id !== person.country_id) return false;
  if (material.country_id && !person.country_id) return false;
  const aud = material.audience ?? [];
  return aud.length === 0 || person.roles.some((r) => aud.includes(r));
}

/** Safe ASCII file name for Content-Disposition. */
export function pdfFileName(title: string, version: number): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "materials";
  return `${base}-v${version}.pdf`;
}
