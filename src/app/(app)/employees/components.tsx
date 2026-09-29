"use client";

import { InviteLinkDialog } from "@/components/shared/invite-link-dialog";
import { Archive, ArchiveRestore, Banknote, Mail, MessageCircle, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DIAL_CODES, normalizePhone, splitPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { CompanySelect } from "@/components/shared/company";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { createEmployee, deleteEmployee, setEmployeeArchived, inviteEmployee, saveCompensation, setEmployeePhoto, updateEmployee } from "./actions";

export type EmployeeValues = {
  id?: string; first_name?: string; last_name?: string | null; email?: string | null; phone?: string | null; job_title?: string | null;
  country_id?: string | null; team_id?: string | null; status?: string; employment_start?: string | null; employment_end?: string | null; notes?: string | null;
  company_id?: string | null; whatsapp?: string | null;
};

/** Country code + number → one hidden E.164 value ("+37126123456"). */
function PhoneField({ name, label, value, onChange, required, hint }: {
  name: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string;
}) {
  const init = splitPhone(value);
  const [code, setCode] = useState(init.code || "+371");
  const [local, setLocal] = useState(init.code ? init.local : value);
  const combined = local.trim().startsWith("+") || local.trim().startsWith("00") ? normalizePhone(local) : local.trim() ? `${code}${normalizePhone(local).replace(/^0+/, "")}` : "";
  const push = (c: string, l: string) => {
    const v = l.trim().startsWith("+") || l.trim().startsWith("00") ? normalizePhone(l) : l.trim() ? `${c}${normalizePhone(l).replace(/^0+/, "")}` : "";
    onChange(v);
  };
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}{!required && <span className="normal-case tracking-normal text-faint">(neobligāts)</span>}</label>
      <div className="flex gap-2">
        <select aria-label="Valsts kods" value={code} onChange={(e) => { setCode(e.target.value); push(e.target.value, local); }} className="field w-[7.5rem] shrink-0">
          {DIAL_CODES.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
        </select>
        <input type="tel" inputMode="tel" autoComplete="off" value={local} required={required} placeholder="26 123 456"
          onChange={(e) => { setLocal(e.target.value); push(code, e.target.value); }} className="field min-w-0 flex-1" aria-label={label} />
      </div>
      <input type="hidden" name={name} value={combined} />
      <p className="mt-1 text-xs text-faint">{combined ? <>Tiks saglabāts: <span className="font-mono text-ink-2">{combined}</span></> : hint ?? "Pilns numurs ar valsts kodu"}</p>
    </div>
  );
}

function ContactFields({ values }: { values?: EmployeeValues }) {
  const { t } = useT();
  const [phone, setPhone] = useState(values?.phone ?? "");
  const [same, setSame] = useState(!values?.whatsapp || normalizePhone(values.whatsapp) === normalizePhone(values?.phone ?? ""));
  const [wa, setWa] = useState(values?.whatsapp ?? "");
  return (
    <div className="space-y-4">
      <FormGrid>
        <Input name="email" type="email" label={t("employees.email")} defaultValue={values?.email ?? ""} required maxLength={200} autoComplete="off"
          hint="Uz šo e-pastu tiek piesaistīts konts un ielūgums" />
        <PhoneField name="phone" label={t("employees.phone")} value={phone} onChange={setPhone} required />
      </FormGrid>
      <div className="rounded-xl border border-line bg-surface-2/40 p-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="h-4 w-4 accent-[var(--forest-500)]" />
          <MessageCircle className="h-4 w-4 text-ok" /> WhatsApp ir tas pats numurs
          {same && phone && <span className="ml-auto font-mono text-xs text-muted">{phone}</span>}
        </label>
        {same ? <input type="hidden" name="same_whatsapp" value="1" /> : (
          <div className="mt-3 animate-fade-in"><PhoneField name="whatsapp" label="WhatsApp numurs" value={wa} onChange={setWa} /></div>
        )}
      </div>
    </div>
  );
}

const STATUSES = ["active", "on_leave", "inactive", "offboarding"] as const;

function EmployeeFields({ countries, teams, values }: { countries: Option[]; teams: Option[]; values?: EmployeeValues }) {
  const { t, label } = useT();
  return (
    <div className="space-y-4">
      <FormGrid>
        <Input name="first_name" label={t("employees.firstName")} defaultValue={values?.first_name} required maxLength={100} autoComplete="off" />
        <Input name="last_name" label={t("employees.lastName")} defaultValue={values?.last_name ?? ""} maxLength={100} autoComplete="off" />
      </FormGrid>
      <ContactFields values={values} />
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

export function NewEmployeeDialog({ countries, teams, defaultOpen, stay, roles }: {
  countries: Option[]; teams: Option[]; defaultOpen?: boolean; stay?: boolean; /** roles the admin may grant → shows "create account" */ roles?: Option[];
}) {
  const { t } = useT();
  return (
    <InviteLinkDialog wide title={t("employees.new")} action={createEmployee as FormAction} defaultOpen={defaultOpen} submitLabel={t("common.save")}
      trigger={<Button><UserPlus className="h-4 w-4" /> {t("employees.new")}</Button>}>
      {stay && <input type="hidden" name="_stay" value="1" />}
      <EmployeeFields countries={countries} teams={teams} />
      {roles && roles.length > 0 && <AccountFields roles={roles} />}
    </InviteLinkDialog>
  );
}

function AccountFields({ roles }: { roles: Option[] }) {
  const [on, setOn] = useState(true);
  return (
    <div className={cn("mt-4 rounded-xl border p-4 transition", on ? "border-amber/40 bg-amber/[0.05]" : "border-line")}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" name="create_account" value="1" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--amber)]" />
        <span>
          <span className="block text-sm font-medium text-ink">Izveidot kontu platformā un ielūguma saiti</span>
          <span className="block text-xs text-muted">Pēc saglabāšanas saņemsi saiti, ko ar vienu klikšķi nosūtīt uz darbinieka e-pastu vai WhatsApp. Pirmajā ienākšanā viņš obligāti uzliek savu paroli.</span>
        </span>
      </label>
      {on && <div className="mt-3 animate-fade-in"><Select name="role_key" label="Loma" defaultValue="employee" options={roles} /></div>}
    </div>
  );
}

export function EditEmployeeDialog({ countries, teams, values, iconOnly }: { countries: Option[]; teams: Option[]; values: EmployeeValues & { id: string }; iconOnly?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={`${t("common.edit")}: ${values.first_name ?? ""} ${values.last_name ?? ""}`.trim()} action={updateEmployee.bind(null, values.id) as FormAction}
      trigger={iconOnly
        ? <Button size="sm" variant="ghost" aria-label={t("common.edit")} title={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
        : <Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
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

/** Quick actions on an employee card: edit · archive/restore · delete. */
export function EmployeeCardActions({ countries, teams, values, archived, name }: {
  countries: Option[]; teams: Option[]; values: EmployeeValues & { id: string }; archived: boolean; name: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface/95 p-0.5 shadow-lg backdrop-blur">
      <EditEmployeeDialog countries={countries} teams={teams} values={values} iconOnly />
      <ActionButton action={setEmployeeArchived.bind(null, values.id, !archived) as FormAction} variant="ghost" size="sm"
        confirm={archived ? undefined : `Arhivēt ${name}? Vēsture tiks saglabāta, darbinieks vairs nebūs aktīvajā sarakstā.`}>
        {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      </ActionButton>
      <ActionButton action={deleteEmployee.bind(null, values.id) as FormAction} variant="ghost" size="sm" className="text-muted hover:text-crit"
        confirm={`Dzēst ${name}? Darbinieks pazudīs no sarakstiem un zaudēs piekļuvi platformai. Stundas un atskaites vēsturē paliks.`}>
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
