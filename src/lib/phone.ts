/** International phone numbers (E.164: "+" + country code + number, 8–15 digits). */
export const DIAL_CODES = [
  { code: "+371", country: "LV", label: "🇱🇻 +371" },
  { code: "+46", country: "SE", label: "🇸🇪 +46" },
  { code: "+354", country: "IS", label: "🇮🇸 +354" },
  { code: "+370", country: "LT", label: "🇱🇹 +370" },
  { code: "+372", country: "EE", label: "🇪🇪 +372" },
  { code: "+358", country: "FI", label: "🇫🇮 +358" },
  { code: "+47", country: "NO", label: "🇳🇴 +47" },
  { code: "+48", country: "PL", label: "🇵🇱 +48" },
  { code: "+380", country: "UA", label: "🇺🇦 +380" },
  { code: "+49", country: "DE", label: "🇩🇪 +49" },
  { code: "+44", country: "GB", label: "🇬🇧 +44" },
  { code: "+34", country: "ES", label: "🇪🇸 +34" },
] as const;

/** Strips spaces, dashes, dots and brackets; "00" prefix → "+". */
export function normalizePhone(input: string): string {
  let s = input.trim().replace(/[\s().\-/]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return s;
}

export const E164 = /^\+[1-9]\d{7,14}$/;
export const isE164 = (s: string) => E164.test(normalizePhone(s));

/** Splits a stored number into dial code + local part for the form. */
export function splitPhone(value: string | null | undefined, fallback = "+371"): { code: string; local: string } {
  const v = normalizePhone(value ?? "");
  const hit = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find((d) => v.startsWith(d.code));
  if (hit) return { code: hit.code, local: v.slice(hit.code.length) };
  if (v.startsWith("+")) return { code: "", local: v };
  return { code: fallback, local: v };
}

/** "+37126123456" → "+371 26 123 456" (readable, still dialable). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const { code, local } = splitPhone(value, "");
  if (!code) return value;
  return `${code} ${local.replace(/(\d{2,3})(?=(\d{3})+$)/g, "$1 ").trim()}`;
}

/** wa.me wants digits only (no "+"). */
export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${normalizePhone(phone).replace(/^\+/, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
