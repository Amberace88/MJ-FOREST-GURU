"use client";

import { CheckCircle2, GraduationCap, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { Checkbox, FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { createCourse, createTrainingRecord, updateCourse, updateTrainingRecord } from "./actions";

const CERT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export type CourseOption = { value: string; label: string; validityMonths: number | null; required: boolean };

function CertificateSlot({ orgId, employeeId, hasExisting }: { orgId: string; employeeId: string | null; hasExisting?: boolean }) {
  const { t } = useT();
  const [fileId, setFileId] = useState<string | null>(null);
  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {t("training.certificateFile")} <span className="normal-case tracking-normal text-faint">({t("common.optional")})</span>
      </span>
      {fileId && <input type="hidden" name="certificate_file_id" value={fileId} />}
      {!employeeId ? (
        <p className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-xs text-muted">{t("training.chooseEmployeeFirst")}</p>
      ) : fileId ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {t("documents.fileAttached")}</span>
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setFileId(null)}>{t("common.clear")}</button>
        </div>
      ) : (
        <FileUploader key={employeeId} orgId={orgId} entityType="employee" entityId={employeeId} bucket="documents" kind="document"
          accept={CERT_ACCEPT} multiple={false} compact={hasExisting} label={hasExisting ? t("documents.replaceFile") : t("documents.attachFile")}
          onUploaded={(ids) => setFileId(ids[ids.length - 1] ?? null)} />
      )}
    </div>
  );
}

type RecordValues = {
  id?: string; employee_id?: string; training_id?: string | null; title?: string; completed_at?: string | null; expires_at?: string | null;
  certificate_number?: string | null; certificate_file_id?: string | null; notes?: string | null;
};

function RecordFields({ orgId, employees, courses, values, fixedEmployee }: { orgId: string; employees: Option[]; courses: CourseOption[]; values?: RecordValues; fixedEmployee?: boolean }) {
  const { t } = useT();
  const [employeeId, setEmployeeId] = useState(values?.employee_id ?? "");
  const [courseId, setCourseId] = useState(values?.training_id ?? "");
  const course = courses.find((c) => c.value === courseId);
  return (
    <div className="space-y-4">
      <FormGrid>
        {fixedEmployee ? (
          <Input label={t("common.employee")} value={employees.find((e) => e.value === employeeId)?.label ?? ""} readOnly disabled />
        ) : (
          <Select name="employee_id" label={t("common.employee")} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} options={employees} placeholder="" required />
        )}
        <Select name="training_id" label={t("training.course")} value={courseId} onChange={(e) => setCourseId(e.target.value)}
          options={courses.map((c) => ({ value: c.value, label: c.required ? `${c.label} ★` : c.label }))} placeholder={t("training.noCourse")} />
      </FormGrid>
      <Input name="title" label={t("training.titleLabel")} defaultValue={values?.title ?? ""} maxLength={200}
        placeholder={course?.label} optional={Boolean(courseId)} required={!courseId} hint={courseId ? t("training.titleHint") : undefined} />
      <FormGrid cols={3}>
        <Input name="completed_at" type="date" label={t("training.completed")} defaultValue={values?.completed_at ?? ""} optional />
        <Input name="expires_at" type="date" label={t("training.expires")} defaultValue={values?.expires_at ?? ""} optional
          hint={course?.validityMonths ? `${t("training.expiresHint")} (${t("training.validFor", { n: course.validityMonths })})` : undefined} />
        <Input name="certificate_number" label={t("training.certificate")} defaultValue={values?.certificate_number ?? ""} optional maxLength={120} />
      </FormGrid>
      <CertificateSlot orgId={orgId} employeeId={employeeId || null} hasExisting={Boolean(values?.certificate_file_id)} />
      <Textarea name="notes" label={t("common.notes")} defaultValue={values?.notes ?? ""} optional maxLength={4000} />
    </div>
  );
}

export function NewTrainingDialog({ orgId, employees, courses, defaultOpen, initialEmployee }: { orgId: string; employees: Option[]; courses: CourseOption[]; defaultOpen?: boolean; initialEmployee?: string }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("training.new")} action={createTrainingRecord as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("training.new")}</Button>}>
      <RecordFields orgId={orgId} employees={employees} courses={courses} values={initialEmployee ? { employee_id: initialEmployee } : undefined} />
    </FormDialog>
  );
}

export function EditTrainingDialog({ orgId, employees, courses, values }: { orgId: string; employees: Option[]; courses: CourseOption[]; values: RecordValues & { id: string } }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("training.editRecord")} action={updateTrainingRecord.bind(null, values.id) as FormAction}
      trigger={<Button size="xs" variant="ghost" aria-label={t("common.edit")}><Pencil className="h-3.5 w-3.5" /></Button>}>
      <RecordFields orgId={orgId} employees={employees} courses={courses} values={values} fixedEmployee />
    </FormDialog>
  );
}

type CourseValues = { id?: string; title?: string; description?: string | null; country_id?: string | null; validity_months?: number | null; is_required?: boolean; applies_to_job_titles?: string[] | null };

function CourseFields({ countries, values }: { countries: Option[]; values?: CourseValues }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Input name="title" label={t("training.titleLabel")} defaultValue={values?.title} required maxLength={200} />
      <FormGrid cols={3}>
        <Select name="country_id" label={t("common.country")} defaultValue={values?.country_id ?? ""} options={countries} placeholder={t("training.allCountries")} />
        <Input name="validity_months" type="number" min={1} max={600} step={1} label={t("training.validity")} defaultValue={values?.validity_months ?? ""} optional />
        <div className="flex items-end pb-2.5"><Checkbox name="is_required" label={t("training.required")} defaultChecked={values?.is_required} /></div>
      </FormGrid>
      <Input name="applies_to" label={t("training.appliesTo")} hint={t("training.appliesToHint")} defaultValue={(values?.applies_to_job_titles ?? []).join(", ")} optional maxLength={1000} />
      <Textarea name="description" label={t("common.description")} defaultValue={values?.description ?? ""} optional maxLength={4000} />
    </div>
  );
}

export function NewCourseDialog({ countries }: { countries: Option[] }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("training.newCourse")} action={createCourse as FormAction}
      trigger={<Button variant="secondary"><GraduationCap className="h-4 w-4" /> {t("training.newCourse")}</Button>}>
      <CourseFields countries={countries} />
    </FormDialog>
  );
}

export function EditCourseDialog({ countries, values }: { countries: Option[]; values: CourseValues & { id: string } }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("training.editCourse")} action={updateCourse.bind(null, values.id) as FormAction}
      trigger={<Button size="xs" variant="ghost" aria-label={t("common.edit")}><Pencil className="h-3.5 w-3.5" /></Button>}>
      <CourseFields countries={countries} values={values} />
    </FormDialog>
  );
}
