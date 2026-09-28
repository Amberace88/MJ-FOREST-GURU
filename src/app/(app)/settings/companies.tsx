"use client";

import { Check, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CompanyDot } from "@/components/ui/company-badge";
import { ActionButton, Checkbox, FormDialog, FormGrid, Input, Select, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { COMPANY_COLORS, DEFAULT_COMPANY_COLOR, companyColor } from "@/lib/companies";
import { cn } from "@/lib/utils";
import { removeCompany, saveCompany, setCompanyActive } from "./companies-actions";

export type CompanyRow = {
  id: string; name: string; legal_name: string | null; registration_number: string | null; vat_number: string | null;
  country_id: string | null; address: string | null; email: string | null; phone: string | null;
  color: string; is_active: boolean; sort_order: number;
};

/** Swatch palette submitted as `color` (radio group). Unknown stored colors are kept as an extra swatch. */
function ColorPicker({ defaultValue }: { defaultValue: string }) {
  const { t, label } = useT();
  const [value, setValue] = useState(defaultValue.toLowerCase());
  const hintId = useId();
  const swatches: { key: string; hex: string }[] = COMPANY_COLORS.map((c) => ({ key: c.key, hex: c.hex.toLowerCase() }));
  if (!swatches.some((s) => s.hex === value)) swatches.push({ key: "custom", hex: companyColor(value) });
  return (
    <fieldset aria-describedby={hintId}>
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("companies.color")}</legend>
      <div className="flex flex-wrap gap-2.5">
        {swatches.map((s) => {
          const checked = s.hex === value;
          const name = s.key === "custom" ? s.hex : label("companies.colors", s.key);
          return (
            <label key={s.hex} title={name}
              className={cn("relative grid h-10 w-10 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-110",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber", checked && "scale-110 ring-2 ring-ink/70")}
              style={{ backgroundColor: s.hex, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.18), 0 6px 16px -6px ${s.hex}` }}>
              <input type="radio" name="color" value={s.hex} checked={checked} onChange={() => setValue(s.hex)} className="sr-only" />
              <span className="sr-only">{name}</span>
              {checked && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden />}
            </label>
          );
        })}
      </div>
      <p id={hintId} className="mt-1.5 text-xs text-faint">{t("companies.colorHint")}</p>
    </fieldset>
  );
}

function CompanyFields({ company, countries }: { company?: CompanyRow; countries: Option[] }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <FormGrid>
        <Input name="name" label={t("companies.name")} hint={t("companies.nameHint")} defaultValue={company?.name} required maxLength={200} autoComplete="off" />
        <Input name="legal_name" label={t("companies.legalName")} defaultValue={company?.legal_name ?? ""} optional maxLength={200} autoComplete="off" />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="registration_number" label={t("companies.regNo")} defaultValue={company?.registration_number ?? ""} optional maxLength={60} autoComplete="off" />
        <Input name="vat_number" label={t("companies.vatNo")} defaultValue={company?.vat_number ?? ""} optional maxLength={60} autoComplete="off" autoCapitalize="characters" />
        <Select name="country_id" label={t("companies.country")} defaultValue={company?.country_id ?? ""} options={countries} placeholder="" optional />
      </FormGrid>
      <Input name="address" label={t("companies.address")} defaultValue={company?.address ?? ""} optional maxLength={300} />
      <FormGrid>
        <Input name="email" type="email" label={t("companies.email")} defaultValue={company?.email ?? ""} optional maxLength={200} autoComplete="off" />
        <Input name="phone" type="tel" label={t("companies.phone")} defaultValue={company?.phone ?? ""} optional maxLength={40} autoComplete="off" />
      </FormGrid>
      <ColorPicker defaultValue={company?.color ?? DEFAULT_COMPANY_COLOR} />
      <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-end">
        <div>
          <Checkbox name="is_active" label={t("companies.activeLabel")} defaultChecked={company?.is_active ?? true} />
          <p className="mt-1 text-xs text-faint">{t("companies.activeHint")}</p>
        </div>
        <Input name="sort_order" type="number" inputMode="numeric" min={0} max={9999} step={1} label={t("companies.sortOrder")} defaultValue={company?.sort_order ?? 0} />
      </div>
    </div>
  );
}

export function CompanyDialog({ company, countries, compact }: { company?: CompanyRow; countries: Option[]; compact?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg"
      title={company ? <span className="flex items-center gap-2.5"><CompanyDot color={company.color} className="h-3 w-3" />{company.name}</span> : t("companies.add")}
      description={company ? t("companies.edit") : t("companies.hint")}
      action={saveCompany.bind(null, company?.id ?? "") as FormAction}
      trigger={company
        ? <Button size="sm" variant="ghost" aria-label={`${t("common.edit")}: ${company.name}`}><Pencil className="h-4 w-4" />{!compact && <span className="hidden sm:inline">{t("common.edit")}</span>}</Button>
        : <Button size={compact ? "sm" : "md"}><Plus className="h-4 w-4" /> {t("companies.add")}</Button>}>
      <CompanyFields company={company} countries={countries} />
    </FormDialog>
  );
}

export function CompanyToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useT();
  return (
    <ActionButton action={setCompanyActive.bind(null, id, !active) as FormAction} variant="ghost" size="sm"
      confirm={active ? t("companies.confirmDeactivate") : undefined}>
      {active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      <span className="sr-only">{active ? t("companies.deactivate") : t("companies.activate")}</span>
    </ActionButton>
  );
}

export function CompanyRemove({ id }: { id: string }) {
  const { t } = useT();
  return (
    <ActionButton action={removeCompany.bind(null, id) as FormAction} variant="ghost" size="sm" confirm={t("companies.confirmRemove")}
      className="text-muted hover:text-crit">
      <Trash2 className="h-4 w-4" /><span className="sr-only">{t("companies.remove")}</span>
    </ActionButton>
  );
}
