"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { addWorkSite, assignMachine, assignTeam, assignWorker, createProject, updateProject } from "./actions";

type Country = { id: string; name: string; flag: string | null; site_identifier_fields: string[] };
export type ProjectValues = {
  id?: string; code?: string; name?: string; country_id?: string; client_name?: string | null; status?: string; location_name?: string | null;
  address?: string | null; latitude?: number | null; longitude?: number | null; area_ha?: number | null; start_date?: string | null;
  expected_end_date?: string | null; actual_end_date?: string | null; notes?: string | null; site_identifiers?: Record<string, string>;
};

function ProjectFields({ countries, values }: { countries: Country[]; values?: ProjectValues }) {
  const { t, label } = useT();
  const [countryId, setCountryId] = useState(values?.country_id ?? countries[0]?.id ?? "");
  const country = countries.find((c) => c.id === countryId);
  const idFields = country?.site_identifier_fields ?? [];
  const statuses = ["planned", "active", "paused", "completed", "cancelled"].map((s) => ({ value: s, label: label("projects.status", s) }));
  return (
    <div className="space-y-4">
      <FormGrid cols={3}>
        <Input name="code" label={t("projects.code")} hint={t("projects.codeHint")} defaultValue={values?.code} required maxLength={40} />
        <Input name="name" label={t("projects.name")} defaultValue={values?.name} required className="sm:col-span-2" maxLength={200} />
      </FormGrid>
      <FormGrid cols={3}>
        <Select name="country_id" label={t("common.country")} value={countryId} onChange={(e) => setCountryId(e.target.value)}
          options={countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}` }))} required />
        <Select name="status" label={t("common.status")} defaultValue={values?.status ?? "planned"} options={statuses} />
        <Input name="client_name" label={t("projects.client")} defaultValue={values?.client_name ?? ""} optional />
      </FormGrid>
      {idFields.length > 0 && (
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("projects.identifiers")} · {country?.name}</legend>
          <FormGrid>
            {idFields.map((k) => (
              <Input key={`${countryId}-${k}`} name={`id_${k}`} label={label("projects.identifierFields", k)} defaultValue={values?.site_identifiers?.[k] ?? ""} optional />
            ))}
          </FormGrid>
        </fieldset>
      )}
      <FormGrid cols={3}>
        <Input name="location_name" label={t("projects.locationName")} defaultValue={values?.location_name ?? ""} optional />
        <Input name="latitude" label={t("projects.latitude")} type="number" step="0.000001" min={-90} max={90} defaultValue={values?.latitude ?? ""} optional />
        <Input name="longitude" label={t("projects.longitude")} type="number" step="0.000001" min={-180} max={180} defaultValue={values?.longitude ?? ""} optional />
      </FormGrid>
      <FormGrid cols={2}>
        <Input name="address" label={t("common.address")} defaultValue={values?.address ?? ""} optional />
        <Input name="area_ha" label={t("projects.area")} type="number" step="0.01" min={0} defaultValue={values?.area_ha ?? ""} optional />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="start_date" type="date" label={t("projects.startDate")} defaultValue={values?.start_date ?? ""} optional />
        <Input name="expected_end_date" type="date" label={t("projects.expectedEnd")} defaultValue={values?.expected_end_date ?? ""} optional />
        <Input name="actual_end_date" type="date" label={t("projects.actualEnd")} defaultValue={values?.actual_end_date ?? ""} optional />
      </FormGrid>
      <Textarea name="notes" label={t("common.notes")} defaultValue={values?.notes ?? ""} optional />
    </div>
  );
}

export function NewProjectDialog({ countries, defaultOpen, stay }: { countries: Country[]; defaultOpen?: boolean; stay?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("projects.new")} action={createProject as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("projects.new")}</Button>}>
      {stay && <input type="hidden" name="_stay" value="1" />}
      <ProjectFields countries={countries} />
    </FormDialog>
  );
}

export function EditProjectDialog({ countries, values }: { countries: Country[]; values: ProjectValues }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={`${t("common.edit")}: ${values.code}`} action={updateProject.bind(null, values.id!) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <ProjectFields countries={countries} values={values} />
    </FormDialog>
  );
}

export function AssignWorkerDialog({ projectId, employees }: { projectId: string; employees: Option[] }) {
  const { t, label } = useT();
  return (
    <FormDialog size="sm" title={t("projects.assignWorker")} action={assignWorker.bind(null, projectId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><Plus className="h-4 w-4" /> {t("projects.assignWorker")}</Button>}>
      <div className="space-y-4">
        <Select name="employee_id" label={t("common.employee")} options={employees} placeholder="" required />
        <Select name="project_role" label={t("common.type")} options={["worker", "foreman", "manager", "mechanic"].map((r) => ({ value: r, label: label("projects.projectRole", r) }))} />
      </div>
    </FormDialog>
  );
}

export function AssignMachineDialog({ projectId, machines }: { projectId: string; machines: Option[] }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("projects.assignMachine")} action={assignMachine.bind(null, projectId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><Plus className="h-4 w-4" /> {t("projects.assignMachine")}</Button>}>
      <Select name="machine_id" label={t("common.machine")} options={machines} placeholder="" required />
    </FormDialog>
  );
}

export function AssignTeamDialog({ projectId, teams }: { projectId: string; teams: Option[] }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("projects.assignTeam")} action={assignTeam.bind(null, projectId) as FormAction}
      trigger={<Button size="sm" variant="ghost"><Plus className="h-4 w-4" /> {t("projects.assignTeam")}</Button>}>
      <Select name="team_id" label={t("common.team")} options={teams} placeholder="" required />
    </FormDialog>
  );
}

export function AddWorkSiteDialog({ projectId, identifierFields }: { projectId: string; identifierFields: string[] }) {
  const { t, label } = useT();
  return (
    <FormDialog size="md" title={t("projects.workSites")} action={addWorkSite.bind(null, projectId) as FormAction}
      trigger={<Button size="sm" variant="ghost"><Plus className="h-4 w-4" /> {t("common.add")}</Button>}>
      <div className="space-y-4">
        <Input name="name" label={t("common.name")} required />
        <FormGrid>{identifierFields.map((k) => <Input key={k} name={`id_${k}`} label={label("projects.identifierFields", k)} optional />)}</FormGrid>
        <FormGrid cols={3}>
          <Input name="latitude" type="number" step="0.000001" label={t("projects.latitude")} optional />
          <Input name="longitude" type="number" step="0.000001" label={t("projects.longitude")} optional />
          <Input name="area_ha" type="number" step="0.01" label={t("projects.area")} optional />
        </FormGrid>
      </div>
    </FormDialog>
  );
}
