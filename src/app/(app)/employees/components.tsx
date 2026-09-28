"use client";

import { InviteLinkDialog } from "@/components/shared/invite-link-dialog";
import { Banknote, Mail, Pencil, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CompanySelect } from "@/components/shared/company";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { createEmployee, inviteEmployee, saveCompensation, setEmployeePhoto, updateEmployee } from "./actions";

export type EmployeeValues = {
  id?: string; first_name?: string; last_name?: string | null; email?: string | null; phone?: string | null; job_title?: string | null;
  country_id?: string | null; team_id?: string | null; status?: string; employment_start?: string | null; employment_end?: string | null; notes?: string | null;
  company_id?: string | null;
};

const STATUSES = ["active", "on_leave", "inactive", "offboarding"] as const;

function EmployeeFields({ countries, teams, values }: { countries: Option[]; teams: Option[]; values?: EmployeeValues }) {
  const { t, label } = useT();
  return (
    <div className="space-y-4">
      <FormGrid>
        <Input name="first_name" label={t("employees.firstName")} defaultValue={values?.first_name} required maxLength={100} autoComplete="off" />
        <Input name="last_name" label={t("employees.lastName")} defaultValue={values?.last_name ?? ""} maxLength={100} autoComplete="off" />
      </FormGrid>
      <FormGrid>
        <Input name="email" type="email" label={t("employees.email")} defaultValue={values?.email ?? ""} optional maxLength={200} autoComplete="off" />
        <Input name="phone" type="tel" label={t("employees.phone")} defaultValue={values?.phone ?? ""} optional maxLength={40} autoComplete="off" />
      </FormGrid>
      <CompanySelect value={values ? (values.company_id ?? null) : undefined} />
      <FormGrid cols={3}>
        <Input name="job_title" label={t("employees.jobTitle")} defaultValue={values?.job_title ?? ""} optional maxLength={120} />
        <Select name="country_id" label={t("common.country")} defaultValue={values?.country_id ?? countries[0]?.value ?? ""} options={countries} placeholder="" />
        <Select name="team_id" label={t("common.team")} defaultValue={values?.team_id ?? ""} options={teams} placeholder={t("employees.noTeam")} />
      </FormGrid>
      <FormGrid cols={3}>
        <Select name="status" label={t("common.status")} defaultValue={values?.status ?? "active"} options={STATUSES.map((s) => ({ value: s, label: label("employees.status", s) }))} />
        <Input name="employment_start" type="date" label={t("employees.employmentStart")} defaultValue={values?.employment_start ?? ""} optional />
        <Input name="employment_end" type="date" label={t("employees.employmentEnd")} defaultValue={values?.employment_end ?? ""} optional />
      </FormGrid>
      <Textarea name="notes" label={t("common.notes")} defaultValue={values?.notes ?? ""} optional maxLength={4000} />
    </div>
  );
}

export function NewEmployeeDialog({ countries, teams, defaultOpen, stay }: { countries: Option[]; teams: Option[]; defaultOpen?: boolean; stay?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("employees.new")} action={createEmployee as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><UserPlus className="h-4 w-4" /> {t("employees.new")}</Button>}>
      {stay && <input type="hidden" name="_stay" value="1" />}
      <EmployeeFields countries={countries} teams={teams} />
    </FormDialog>
  );
}

export function EditEmployeeDialog({ countries, teams, values }: { countries: Option[]; teams: Option[]; values: EmployeeValues & { id: string } }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={`${t("common.edit")}: ${values.first_name ?? ""} ${values.last_name ?? ""}`.trim()} action={updateEmployee.bind(null, values.id) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <EmployeeFields countries={countries} teams={teams} values={values} />
    </FormDialog>
  );
}

export function CompensationDialog({ employeeId, values }: { employeeId: string; values: { hourly_rate: number | null; monthly_salary: number | null; currency: string } | null }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("employees.editCompensation")} description={t("employees.compensationHint")} action={saveCompensation.bind(null, employeeId) as FormAction}
      trigger={<Button size="sm" variant="ghost"><Banknote className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <div className="space-y-4">
        <FormGrid>
          <Input name="hourly_rate" type="number" step="0.01" min={0} label={t("employees.hourlyRate")} defaultValue={values?.hourly_rate ?? ""} optional />
          <Input name="monthly_salary" type="number" step="0.01" min={0} label={t("employees.monthlySalary")} defaultValue={values?.monthly_salary ?? ""} optional />
        </FormGrid>
        <Select name="currency" label={t("common.currency")} defaultValue={values?.currency ?? "EUR"} options={["EUR", "SEK", "ISK"].map((c) => ({ value: c, label: c }))} />
      </div>
    </FormDialog>
  );
}

export function InviteDialog({ employeeId, email, roles, disabledReason }: { employeeId: string; email: string | null; roles: Option[]; disabledReason?: string | null }) {
  const { t } = useT();
  if (disabledReason) {
    return <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">{disabledReason}</p>;
  }
  return (
    <InviteLinkDialog title={t("employees.invite")} description={t("employees.accountHint")} action={inviteEmployee.bind(null, employeeId) as FormAction}
      trigger={<Button size="sm" variant="amber"><Mail className="h-4 w-4" /> {t("employees.invite")}</Button>}>
      <div className="space-y-4">
        <Input name="email" type="email" label={t("employees.email")} defaultValue={email ?? ""} required maxLength={200} autoComplete="off" />
        <Select name="role_key" label={t("employees.inviteRole")} defaultValue="employee" options={roles} required />
      </div>
    </InviteLinkDialog>
  );
}

/** Avatar upload: stores in the private media bucket, then links the file as employees.photo_path. */
export function PhotoUploader({ orgId, employeeId }: { orgId: string; employeeId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="w-full sm:w-auto">
      <FileUploader orgId={orgId} entityType="employee" entityId={employeeId} bucket="media" kind="avatar" accept="image/jpeg,image/png,image/webp"
        multiple={false} compact label={t("employees.changePhoto")}
        onUploaded={(ids) => {
          const id = ids[ids.length - 1];
          if (!id) return;
          start(async () => {
            const res = await setEmployeePhoto(employeeId, id);
            if (!res.ok) toast(res.error, "error");
            router.refresh();
          });
        }} />
    </div>
  );
}
