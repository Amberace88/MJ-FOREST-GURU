"use client";

import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton, ActionForm, FormDialog, FormGrid, Input, Label, Select, SubmitButton, type FormAction } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { saveCountry, saveLookup, setCountryActive, setLookupActive, updateAlertConfig, updateCompany, updateWorkRules } from "./actions";
import { ACTIVE_LANGUAGES, ALERT_RULES, CURRENCIES, IDENTIFIER_FIELDS, LANGUAGES, timezoneOptions, type LookupKind } from "./constants";

/* ------------------------------------------------------------ small local primitives */

/** Accessible on/off switch that submits "on" like a checkbox. */
function Switch({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/40 px-4 py-3 transition-colors hover:border-line-strong">
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-surface-3 ring-1 ring-line-strong transition-colors peer-checked:bg-forest-600 peer-focus-visible:ring-2 peer-focus-visible:ring-amber" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-ink-2 shadow transition-transform duration-200 peer-checked:translate-x-5 peer-checked:bg-ink" />
      </span>
    </label>
  );
}

function FormFooter({ children }: { children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
      {children}
      <SubmitButton>{t("common.save")}</SubmitButton>
    </div>
  );
}

/* ------------------------------------------------------------ company */

export type CompanyValues = {
  name: string; legal_name: string | null; registration_number: string | null;
  default_language: string; default_timezone: string; default_currency: string;
};

export function CompanyForm({ values }: { values: CompanyValues }) {
  const { t, label } = useT();
  const langId = useId();
  return (
    <ActionForm action={updateCompany as FormAction}>
      <div className="space-y-4">
        <Input name="name" label={t("settings.companyName")} defaultValue={values.name} required minLength={2} maxLength={200} />
        <FormGrid>
          <Input name="legal_name" label={t("settings.legalName")} defaultValue={values.legal_name ?? ""} optional maxLength={200} />
          <Input name="registration_number" label={t("settings.regNo")} defaultValue={values.registration_number ?? ""} optional maxLength={60} />
        </FormGrid>
        <div className="pt-2">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted">{t("settings.defaults")}</p>
          <FormGrid cols={3}>
            <div>
              <Label htmlFor={langId}>{t("settings.language")}</Label>
              <select id={langId} name="default_language" defaultValue="lv" className="field">
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} disabled={!ACTIVE_LANGUAGES.includes(l)}>{label("settings.languages", l)}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-faint">{t("settings.languageHint")}</p>
            </div>
            <Select name="default_timezone" label={t("settings.timezone")} defaultValue={values.default_timezone} options={timezoneOptions(values.default_timezone)} />
            <Select name="default_currency" label={t("settings.currency")} defaultValue={values.default_currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </FormGrid>
          <p className="mt-2 text-xs text-faint">{t("settings.defaultsHint")}</p>
        </div>
      </div>
      <FormFooter />
    </ActionForm>
  );
}

/* ------------------------------------------------------------ work rules */

export type RulesValues = { overtime_after_hours: number; max_shift_hours: number; missing_checkout_after_hours: number; service_warning_hours: number };

export function WorkRulesForm({ values }: { values: RulesValues }) {
  const { t } = useT();
  return (
    <ActionForm action={updateWorkRules as FormAction}>
      <FormGrid>
        <Input name="overtime_after_hours" type="number" step="0.25" min={1} max={24} inputMode="decimal" label={t("settings.overtimeAfter")} defaultValue={values.overtime_after_hours} required />
        <Input name="max_shift_hours" type="number" step="0.25" min={1} max={24} inputMode="decimal" label={t("settings.maxShift")} defaultValue={values.max_shift_hours} required />
        <Input name="missing_checkout_after_hours" type="number" step="0.25" min={1} max={48} inputMode="decimal" label={t("settings.missingCheckout")} defaultValue={values.missing_checkout_after_hours} required />
        <Input name="service_warning_hours" type="number" step="1" min={0} max={5000} inputMode="numeric" label={t("settings.serviceWarning")} defaultValue={values.service_warning_hours} required />
      </FormGrid>
      <FormFooter />
    </ActionForm>
  );
}

/* ------------------------------------------------------------ alert rules */

export function AlertRulesForm({ config }: { config: Record<string, boolean> }) {
  const { t, label } = useT();
  return (
    <ActionForm action={updateAlertConfig as FormAction}>
      <div className="grid gap-2.5 md:grid-cols-2">
        {ALERT_RULES.map((rule) => (
          <Switch key={rule} name={rule} defaultChecked={config[rule] !== false} label={label("settings.alerts.rules", rule)} />
        ))}
      </div>
      <FormFooter><span className="mr-auto text-xs text-faint">{t("settings.alerts.hint")}</span></FormFooter>
    </ActionForm>
  );
}

/* ------------------------------------------------------------ countries */

export type CountryRow = {
  id: string; code: string; name: string; flag: string | null; timezone: string; currency: string;
  sort_order: number; is_active: boolean; site_identifier_fields: string[];
};

function CountryFields({ country }: { country?: CountryRow }) {
  const { t, label } = useT();
  const [fields, setFields] = useState<string[]>(country?.site_identifier_fields ?? []);
  const toggle = (k: string) => setFields((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  return (
    <div className="space-y-4">
      <FormGrid cols={3}>
        <Input name="code" label={t("settings.countries.code")} hint={country ? undefined : t("settings.countries.codeHint")} defaultValue={country?.code}
          readOnly={Boolean(country)} required pattern="[A-Za-z]{2}" maxLength={2} className="uppercase" autoCapitalize="characters" />
        <Input name="name" label={t("settings.countries.name")} defaultValue={country?.name} required maxLength={80} />
        <Input name="flag" label={t("settings.countries.flag")} defaultValue={country?.flag ?? ""} optional maxLength={16} />
      </FormGrid>
      <FormGrid cols={3}>
        <Select name="timezone" label={t("settings.countries.timezone")} defaultValue={country?.timezone ?? "Europe/Riga"} options={timezoneOptions(country?.timezone)} />
        <Select name="currency" label={t("settings.countries.currency")} defaultValue={country?.currency ?? "EUR"} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <Input name="sort_order" type="number" min={0} max={999} label={t("settings.countries.sortOrder")} defaultValue={country?.sort_order ?? 0} />
      </FormGrid>
      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("settings.countries.identifierFields")}</legend>
        <p className="mb-3 text-xs text-faint">{t("settings.countries.identifierFieldsHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {IDENTIFIER_FIELDS.map((k) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              fields.includes(k) ? "border-forest-600/60 bg-forest-700/25 text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
              <input type="checkbox" name="site_identifier_fields[]" value={k} checked={fields.includes(k)} onChange={() => toggle(k)}
                className="h-4 w-4 accent-[var(--forest-500)]" />
              {label("projects.identifierFields", k)}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function CountryDialog({ country }: { country?: CountryRow }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={country ? `${t("settings.countries.edit")}: ${country.name}` : t("settings.countries.add")}
      action={saveCountry.bind(null, country?.id ?? "") as FormAction}
      trigger={country
        ? <Button size="sm" variant="ghost" aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
        : <Button size="sm"><Plus className="h-4 w-4" /> {t("settings.countries.add")}</Button>}>
      <CountryFields country={country} />
    </FormDialog>
  );
}

export function CountryToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useT();
  return (
    <ActionButton action={setCountryActive.bind(null, id, !active) as FormAction} variant="ghost" size="sm"
      confirm={active ? t("settings.countries.confirmDeactivate") : undefined}>
      {active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      <span className="hidden sm:inline">{active ? t("settings.countries.deactivate") : t("settings.countries.activate")}</span>
    </ActionButton>
  );
}

/* ------------------------------------------------------------ lookups */

export type LookupRow = { id: string; key: string; label: string; sort_order: number; is_active: boolean };

export function LookupDialog({ kind, value }: { kind: LookupKind; value?: LookupRow }) {
  const { t, label } = useT();
  return (
    <FormDialog size="sm" title={value ? t("settings.lookups.editValue") : `${t("settings.lookupNew")} · ${label("settings.lookups.kinds", kind)}`}
      action={saveLookup.bind(null, kind, value?.id ?? "") as FormAction}
      trigger={value
        ? <Button size="sm" variant="ghost" aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
        : <Button size="sm"><Plus className="h-4 w-4" /> {t("settings.lookupNew")}</Button>}>
      <div className="space-y-4">
        <Input name="label" label={t("settings.label")} defaultValue={value?.label} required maxLength={120} />
        <FormGrid>
          {value
            ? <Input name="key_display" label={t("settings.key")} defaultValue={value.key} readOnly disabled />
            : <Input name="key" label={t("settings.key")} hint={t("settings.lookups.keyHint")} required pattern="[a-z0-9_]{1,60}" maxLength={60} autoCapitalize="none" />}
          <Input name="sort_order" type="number" min={0} max={9999} label={t("settings.lookups.sortOrder")} defaultValue={value?.sort_order ?? 0} />
        </FormGrid>
      </div>
    </FormDialog>
  );
}

export function LookupToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useT();
  return (
    <ActionButton action={setLookupActive.bind(null, id, !active) as FormAction} variant="ghost" size="sm">
      {active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      <span className="hidden sm:inline">{active ? t("settings.lookups.deactivate") : t("settings.lookups.activate")}</span>
    </ActionButton>
  );
}
