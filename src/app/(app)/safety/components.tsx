"use client";

import { SAFETY_SECTIONS } from "@/lib/constants";
import { FilePlus2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, FormDialog, FormGrid, Input, Select, Textarea, type FormAction } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { createRule, publishVersion, updateRule } from "./actions";


type CountryOpt = { id: string; name: string; flag: string | null };
export type RuleValues = {
  id: string; section: string; title: string; country_id: string | null; requires_acknowledgement: boolean; is_active: boolean; sort_order: number;
};

function RuleFields({ countries, values, defaultSection }: { countries: CountryOpt[]; values?: RuleValues; defaultSection?: string }) {
  const { t, label } = useT();
  return (
    <div className="space-y-4">
      <FormGrid>
        <Select name="section" label={t("safety.section")} defaultValue={values?.section ?? defaultSection ?? "general"} required
          options={SAFETY_SECTIONS.map((s) => ({ value: s, label: label("safety.sections", s) }))} />
        <Select name="country_id" label={t("safety.countryScope")} defaultValue={values?.country_id ?? ""} placeholder={t("safety.allCountries")}
          options={countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }))} />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="title" label={t("safety.ruleTitle")} defaultValue={values?.title} required maxLength={200} className="sm:col-span-2" />
        <Input name="sort_order" type="number" min={0} max={10000} step={1} label={t("safety.sortOrder")} defaultValue={values?.sort_order ?? 0} optional />
      </FormGrid>
      <Checkbox name="requires_acknowledgement" label={t("safety.requiresAck")} defaultChecked={values?.requires_acknowledgement ?? true} />
    </div>
  );
}

export function NewRuleDialog({ countries, defaultOpen }: { countries: CountryOpt[]; defaultOpen?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("safety.newRule")} action={createRule as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("safety.newRule")}</Button>}>
      <div className="space-y-4">
        <RuleFields countries={countries} />
        <Textarea name="body" label={t("safety.body")} rows={10} required maxLength={20000} />
      </div>
    </FormDialog>
  );
}

export function EditRuleDialog({ countries, values }: { countries: CountryOpt[]; values: RuleValues }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("safety.editRule")} action={updateRule.bind(null, values.id) as FormAction}
      trigger={<Button size="sm" variant="ghost" aria-label={t("safety.editRule")}><Pencil className="h-4 w-4" /> <span className="hidden sm:inline">{t("common.edit")}</span></Button>}>
      <div className="space-y-4">
        <RuleFields countries={countries} values={values} />
        <Checkbox name="is_active" label={t("safety.active")} defaultChecked={values.is_active} />
      </div>
    </FormDialog>
  );
}

export function NewVersionDialog({ ruleId, title, version, body }: { ruleId: string; title: string; version: number; body: string }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={`${t("safety.newVersion")} · v${version + 1}`} description={t("safety.newVersionHint")}
      action={publishVersion.bind(null, ruleId) as FormAction} submitLabel={t("safety.newVersion")}
      trigger={<Button size="sm" variant="secondary"><FilePlus2 className="h-4 w-4" /> {t("safety.newVersion")}</Button>}>
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">{title}</p>
        <Textarea name="body" label={t("safety.body")} rows={14} defaultValue={body} required maxLength={20000} />
      </div>
    </FormDialog>
  );
}
