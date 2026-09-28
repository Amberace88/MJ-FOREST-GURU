"use client";

import { ClipboardCheck, Pencil, Plus, RefreshCw, UserPlus } from "lucide-react";
import { CompanySelect } from "@/components/shared/company";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { addMaintenanceRecord, assignOperator, changeMachineStatus, createMachine, updateMachine } from "./actions";
import { MACHINE_CATEGORIES, MACHINE_STATUSES } from "./ui";

export type MachineValues = {
  id?: string; name?: string; category?: string; status?: string; manufacturer?: string | null; model?: string | null; year?: number | null;
  vin?: string | null; registration_number?: string | null; internal_code?: string | null; country_id?: string | null; fuel_type?: string | null;
  engine_hours?: number | null; mileage_km?: number | null; service_interval_hours?: number | null; last_service_hours?: number | null;
  last_service_at?: string | null; next_service_hours?: number | null; next_service_at?: string | null;
  insurance_valid_until?: string | null; inspection_valid_until?: string | null; notes?: string | null;
  company_id?: string | null;
};

const CURRENCIES: Option[] = ["EUR", "SEK", "ISK"].map((c) => ({ value: c, label: c }));

function numVal(v: number | null | undefined) {
  return v == null ? "" : String(v);
}

/** Fuel type options: organization lookup values, falling back to the built-in list. */
export function useFuelTypeOptions(fuelTypes: Option[], current?: string | null): Option[] {
  const { label } = useT();
  const base = fuelTypes.length ? fuelTypes : ["diesel", "petrol", "hvo", "adblue", "electric", "other"].map((k) => ({ value: k, label: label("fuel.types", k) }));
  return current && !base.some((o) => o.value === current) ? [...base, { value: current, label: current }] : base;
}

function MachineFields({ countries, fuelTypes, values }: { countries: Option[]; fuelTypes: Option[]; values?: MachineValues }) {
  const { t, label } = useT();
  const fuelOpts = useFuelTypeOptions(fuelTypes, values?.fuel_type);
  return (
    <div className="space-y-5">
      <FormGrid cols={3}>
        <Input name="name" label={t("common.name")} defaultValue={values?.name} required maxLength={120} className="sm:col-span-2" placeholder="John Deere 1270G" />
        <Input name="internal_code" label={t("machines.internalCode")} defaultValue={values?.internal_code ?? ""} maxLength={40} optional placeholder="H-01" />
      </FormGrid>
      <CompanySelect value={values ? (values.company_id ?? null) : undefined} />
      <FormGrid cols={3}>
        <Select name="category" label={t("common.category")} defaultValue={values?.category ?? "harvester"} required
          options={MACHINE_CATEGORIES.map((c) => ({ value: c, label: label("machines.categories", c) }))} />
        <Select name="status" label={t("common.status")} defaultValue={values?.status ?? "active"}
          options={MACHINE_STATUSES.map((s) => ({ value: s, label: label("machines.status", s) }))} />
        <Select name="country_id" label={t("common.country")} defaultValue={values?.country_id ?? countries[0]?.value ?? ""} options={countries} placeholder="" optional />
      </FormGrid>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("machines.identification")}</legend>
        <FormGrid cols={3}>
          <Input name="manufacturer" label={t("machines.manufacturer")} defaultValue={values?.manufacturer ?? ""} maxLength={120} optional />
          <Input name="model" label={t("machines.model")} defaultValue={values?.model ?? ""} maxLength={120} optional />
          <Input name="year" type="number" inputMode="numeric" min={1950} max={2100} step={1} label={t("machines.year")} defaultValue={numVal(values?.year)} optional />
          <Input name="vin" label={t("machines.vin")} defaultValue={values?.vin ?? ""} maxLength={40} optional autoCapitalize="characters" />
          <Input name="registration_number" label={t("machines.registration")} defaultValue={values?.registration_number ?? ""} maxLength={40} optional autoCapitalize="characters" />
          <Select name="fuel_type" label={t("machines.fuelType")} defaultValue={values?.fuel_type ?? fuelOpts[0]?.value ?? ""} options={fuelOpts} placeholder="" optional />
        </FormGrid>
      </fieldset>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("machines.metersAndService")}</legend>
        <FormGrid cols={3}>
          <Input name="engine_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.engineHours")} defaultValue={numVal(values?.engine_hours)} optional />
          <Input name="mileage_km" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.mileage")} defaultValue={numVal(values?.mileage_km)} optional />
          <Input name="service_interval_hours" type="number" inputMode="numeric" step={1} min={1} label={t("machines.serviceInterval")} defaultValue={numVal(values?.service_interval_hours)} optional />
          <Input name="last_service_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.lastServiceHours")} defaultValue={numVal(values?.last_service_hours)} optional />
          <Input name="last_service_at" type="date" label={t("machines.lastService")} defaultValue={values?.last_service_at ?? ""} optional />
          <span className="hidden sm:block" />
          <Input name="next_service_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.nextServiceHours")} defaultValue={numVal(values?.next_service_hours)} optional
            hint={t("machines.nextServiceHint")} />
          <Input name="next_service_at" type="date" label={t("machines.nextService")} defaultValue={values?.next_service_at ?? ""} optional />
        </FormGrid>
      </fieldset>

      <FormGrid cols={2}>
        <Input name="insurance_valid_until" type="date" label={t("machines.insurance")} defaultValue={values?.insurance_valid_until ?? ""} optional />
        <Input name="inspection_valid_until" type="date" label={t("machines.inspection")} defaultValue={values?.inspection_valid_until ?? ""} optional />
      </FormGrid>
      <Textarea name="notes" label={t("common.notes")} defaultValue={values?.notes ?? ""} maxLength={4000} optional />
    </div>
  );
}

export function NewMachineDialog({ countries, fuelTypes, defaultOpen, stay }: { countries: Option[]; fuelTypes: Option[]; defaultOpen?: boolean; stay?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("machines.new")} action={createMachine as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("machines.new")}</Button>}>
      {stay && <input type="hidden" name="_stay" value="1" />}
      <MachineFields countries={countries} fuelTypes={fuelTypes} />
    </FormDialog>
  );
}

export function EditMachineDialog({ countries, fuelTypes, values }: { countries: Option[]; fuelTypes: Option[]; values: MachineValues & { id: string } }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={`${t("common.edit")}: ${values.name ?? ""}`} action={updateMachine.bind(null, values.id) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <MachineFields countries={countries} fuelTypes={fuelTypes} values={values} />
    </FormDialog>
  );
}

export function ChangeStatusDialog({ machineId, status }: { machineId: string; status: string }) {
  const { t, label } = useT();
  return (
    <FormDialog size="sm" title={t("machines.changeStatus")} action={changeMachineStatus.bind(null, machineId) as FormAction}
      trigger={<Button variant="secondary"><RefreshCw className="h-4 w-4" /> {t("machines.changeStatus")}</Button>}>
      <div className="grid grid-cols-1 gap-2">
        {MACHINE_STATUSES.map((s) => (
          <label key={s} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm has-[:checked]:border-forest-500 has-[:checked]:bg-forest-800/30">
            <input type="radio" name="status" value={s} defaultChecked={s === status} className="h-4 w-4 accent-[var(--forest-500)]" />
            <span className="font-medium">{label("machines.status", s)}</span>
          </label>
        ))}
      </div>
    </FormDialog>
  );
}

export function AssignOperatorDialog({ machineId, employees, projects, defaultProjectId, nowLocal }: {
  machineId: string; employees: Option[]; projects: Option[]; defaultProjectId?: string | null; nowLocal: string;
}) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("machines.assignOperator")} description={t("machines.assignOperatorHint")} action={assignOperator.bind(null, machineId) as FormAction}
      trigger={<Button size="sm"><UserPlus className="h-4 w-4" /> {t("machines.assignOperator")}</Button>}>
      <div className="space-y-4">
        <Select name="employee_id" label={t("map.operator")} options={employees} placeholder="" required />
        <Select name="project_id" label={t("common.project")} options={projects} placeholder="" defaultValue={defaultProjectId ?? ""} optional />
        <Input name="started_at" type="datetime-local" label={t("machines.usageStart")} defaultValue={nowLocal} max={nowLocal} optional />
      </div>
    </FormDialog>
  );
}

export function AddMaintenanceDialog({ machineId, machines, employees, defaultCurrency, defaultEngineHours, today, defaultOpen, compact }: {
  machineId?: string; machines?: Option[]; employees: Option[]; defaultCurrency: string; defaultEngineHours?: number | null; today: string; defaultOpen?: boolean; compact?: boolean;
}) {
  const { t, label } = useT();
  const types = ["service", "inspection", "oil_change", "tyres", "other"].map((k) => ({ value: k, label: label("maintenance.type", k) }));
  return (
    <FormDialog size="md" title={t("maintenance.addRecord")} action={addMaintenanceRecord.bind(null, machineId ?? null) as FormAction} defaultOpen={defaultOpen}
      trigger={<Button size={compact ? "sm" : "md"} variant="secondary"><ClipboardCheck className="h-4 w-4" /> {t("maintenance.addRecord")}</Button>}>
      <div className="space-y-4">
        {!machineId && <Select name="machine_id" label={t("common.machine")} options={machines ?? []} placeholder="" required />}
        <FormGrid cols={2}>
          <Select name="maintenance_type" label={t("common.type")} options={types} defaultValue="service" />
          <Input name="performed_at" type="date" label={t("maintenance.performedAt")} defaultValue={today} max={today} required />
          <Input name="engine_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.engineHours")} defaultValue={numVal(defaultEngineHours)} optional />
          <Input name="mileage_km" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.mileage")} optional />
        </FormGrid>
        <Textarea name="description" label={t("common.description")} maxLength={4000} optional />
        <FormGrid cols={2}>
          <Input name="cost" type="number" inputMode="decimal" step="0.01" min={0} label={t("maintenance.cost")} optional />
          <Select name="currency" label={t("common.currency")} options={CURRENCIES} defaultValue={defaultCurrency} />
          <Select name="performed_by_employee_id" label={t("maintenance.performedBy")} options={employees} placeholder="" optional />
          <Input name="external_service" label={t("maintenance.externalService")} maxLength={200} optional />
        </FormGrid>
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("machines.nextService")}</legend>
          <FormGrid cols={2}>
            <Input name="next_service_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("machines.nextServiceHours")} optional hint={t("maintenance.nextAutoHint")} />
            <Input name="next_service_at" type="date" label={t("machines.nextService")} min={today} optional />
          </FormGrid>
        </fieldset>
      </div>
    </FormDialog>
  );
}
