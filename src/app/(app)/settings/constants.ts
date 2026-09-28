/** Shared (client + server) constants for the settings module. */

export const SETTINGS_TABS = ["general", "rules", "countries", "lookups", "alerts"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const LANGUAGES = ["lv", "sv", "en", "is"] as const;
/** Only Latvian ships in the MVP; others are shown as "drīzumā". */
export const ACTIVE_LANGUAGES: readonly string[] = ["lv"];

export const CURRENCIES = ["EUR", "SEK", "ISK"] as const;

export const TIMEZONES = [
  "Europe/Riga", "Europe/Stockholm", "Atlantic/Reykjavik", "Europe/Tallinn", "Europe/Vilnius", "Europe/Helsinki",
  "Europe/Oslo", "Europe/Copenhagen", "Europe/Warsaw", "Europe/Berlin", "Europe/London", "UTC",
] as const;

export const IDENTIFIER_FIELDS = ["cirsmas_numurs", "kadastra_numurs", "fastighet", "work_site_id", "local_description", "location_name"] as const;

export const LOOKUP_KINDS = ["work_type", "fuel_type", "problem_category", "document_type", "expense_category", "production_unit"] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];

/** Keys read by public.get_alerts() from organization_settings.alert_config (missing key = enabled). */
export const ALERT_RULES = [
  "repair_critical", "missing_checkout", "service_due", "machine_documents", "incident", "document_expiring",
  "training_expiring", "expense_pending", "project_deadline", "fuel_anomaly", "telemetry_missing", "machine_inactive",
] as const;
export type AlertRule = (typeof ALERT_RULES)[number];

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timezoneOptions(current?: string | null) {
  const list: string[] = [...TIMEZONES];
  if (current && !list.includes(current)) list.unshift(current);
  return list.map((tz) => ({ value: tz, label: tz.replace("_", " ") }));
}
