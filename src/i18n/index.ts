import { lv, type Dictionary } from "./lv";

export const LOCALES = ["lv", "sv", "en", "is"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "lv";

/** Only Latvian ships in the MVP; other locales fall back to it until translated. */
const dictionaries: Partial<Record<Locale, Dictionary>> = { lv };

export function getDictionary(locale: string | null | undefined): Dictionary {
  const l = (LOCALES as readonly string[]).includes(locale ?? "") ? (locale as Locale) : DEFAULT_LOCALE;
  return dictionaries[l] ?? lv;
}

type Leaves<T, P extends string = ""> = T extends string
  ? P
  : T extends readonly string[]
    ? P
    : { [K in keyof T & string]: Leaves<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string];

export type TKey = Leaves<Dictionary>;
export type TVars = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(s: string, vars?: TVars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function createT(dict: Dictionary) {
  /** Static, type-checked keys. */
  function t(key: TKey, vars?: TVars): string {
    const v = lookup(dict, key);
    return typeof v === "string" ? interpolate(v, vars) : key;
  }
  /** Enum-like labels: label("projects.status", row.status). Falls back to the raw value. */
  function label(group: string, value: string | null | undefined, fallback?: string): string {
    if (value == null || value === "") return fallback ?? "—";
    const v = lookup(dict, `${group}.${value}`);
    return typeof v === "string" ? v : (fallback ?? value);
  }
  function list(key: TKey): readonly string[] {
    const v = lookup(dict, key);
    return Array.isArray(v) ? v : [];
  }
  return { t, label, list, dict };
}

export type Translator = ReturnType<typeof createT>;
