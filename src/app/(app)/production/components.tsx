"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { createProduction } from "./actions";

const UNITS = ["m3", "units", "loads", "other"] as const;

export type ProductionFormOptions = {
  projects: Option[]; machines: Option[]; employees: Option[]; teams: Option[]; workTypes: Option[];
  sites: { id: string; name: string; project_id: string }[];
};

export function NewProductionDialog({ options, today, canPickEmployee, defaultEmployeeId, defaultProjectId, defaultOpen }: {
  options: ProductionFormOptions; today: string; canPickEmployee: boolean; defaultEmployeeId: string | null; defaultProjectId?: string; defaultOpen?: boolean;
}) {
  const { t, label } = useT();
  return (
    <FormDialog size="lg" title={t("production.new")} action={createProduction as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("production.new")}</Button>}>
      <ProductionFields options={options} today={today} canPickEmployee={canPickEmployee} defaultEmployeeId={defaultEmployeeId}
        defaultProjectId={defaultProjectId} unitLabel={(u) => label("production.units", u)} />
    </FormDialog>
  );
}

function ProductionFields({ options, today, canPickEmployee, defaultEmployeeId, defaultProjectId, unitLabel }: {
  options: ProductionFormOptions; today: string; canPickEmployee: boolean; defaultEmployeeId: string | null; defaultProjectId?: string; unitLabel: (u: string) => string;
}) {
  const { t } = useT();
  const [projectId, setProjectId] = useState(defaultProjectId && options.projects.some((p) => p.value === defaultProjectId) ? defaultProjectId : "");
  const [unit, setUnit] = useState<string>("m3");
  const sites = options.sites.filter((s) => s.project_id === projectId).map((s) => ({ value: s.id, label: s.name }));
  return (
    <div className="space-y-4">
      <FormGrid cols={2}>
        <Select name="project_id" label={t("common.project")} value={projectId} onChange={(e) => setProjectId(e.target.value)} options={options.projects} placeholder="" required />
        <Select key={projectId} name="work_site_id" label={t("production.workSite")} options={sites} placeholder="" optional disabled={!sites.length}
          hint={projectId && !sites.length ? t("production.noSites") : undefined} />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="production_date" type="date" label={t("common.date")} defaultValue={today} max={today} required />
        <Input name="quantity" type="number" inputMode="decimal" step="0.01" min={0.01} max={99999.99} label={t("production.quantity")} required />
        <Select name="unit" label={t("production.unit")} value={unit} onChange={(e) => setUnit(e.target.value)} options={UNITS.map((u) => ({ value: u, label: unitLabel(u) }))} />
      </FormGrid>
      {unit === "other" && (
        <Input name="unit_label" label={t("production.unitLabel")} hint={t("production.unitLabelHint")} required maxLength={40} className="animate-fade-up" />
      )}
      <FormGrid cols={2}>
        {canPickEmployee ? (
          <Select name="employee_id" label={t("common.employee")} defaultValue={defaultEmployeeId ?? ""} options={options.employees} placeholder="" optional />
        ) : null}
        <Select name="team_id" label={t("common.team")} options={options.teams} placeholder="" optional />
        <Select name="machine_id" label={t("common.machine")} options={options.machines} placeholder="" optional />
        {options.workTypes.length > 0 ? (
          <Select name="work_type" label={t("hours.workType")} options={options.workTypes} placeholder="" optional />
        ) : (
          <Input name="work_type" label={t("hours.workType")} maxLength={80} optional />
        )}
      </FormGrid>
      <Textarea name="notes" label={t("common.notes")} rows={2} maxLength={2000} optional />
    </div>
  );
}
