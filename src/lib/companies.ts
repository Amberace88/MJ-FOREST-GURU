/** Shared (client + server) helpers for legal companies managed inside the organization. */

/** Minimal company shape used by the shell, filters, badges and selects. */
export type CompanyLite = { id: string; name: string; color: string; country_id: string | null; is_active: boolean };

/** Curated palette (readable on the dark and light themes). Keys map to `companies.colors.*`. */
export const COMPANY_COLORS = [
  { key: "forest", hex: "#3a7a48" },
  { key: "fjord", hex: "#2f7f86" },
  { key: "lake", hex: "#3b6ea8" },
  { key: "heather", hex: "#6b5ca5" },
  { key: "berry", hex: "#a0527a" },
  { key: "rust", hex: "#b5543c" },
  { key: "amber", hex: "#c8912c" },
  { key: "bark", hex: "#7a6a4f" },
] as const;

export const DEFAULT_COMPANY_COLOR = COMPANY_COLORS[0].hex;

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Safe CSS color for inline styles (falls back to the default palette color). */
export function companyColor(color: string | null | undefined) {
  return color && HEX_COLOR_RE.test(color) ? color : DEFAULT_COMPANY_COLOR;
}

/** Company filter for list pages: a valid `?company=` URL value wins, else the global (topbar) filter. */
export function pickCompanyFilter(param: string | undefined, all: readonly CompanyLite[], fallback: string | null): string | null {
  if (param && all.some((c) => c.id === param)) return param;
  return fallback;
}

/** `{value,label}` options of active companies for FilterBar selects. */
export function companyFilterOptions(companies: readonly CompanyLite[]) {
  return companies.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }));
}
