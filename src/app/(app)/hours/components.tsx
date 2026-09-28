"use client";

import { CheckCheck, Pencil, Plus, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { addManualLog, approveWorkLogs, closeOpenShift, correctWorkLog } from "./actions";

type Opts = { employees: Option[]; projects: Option[]; machines: Option[]; workTypes: Option[] };

export function ManualLogDialog({ opts, defaultEmployee }: { opts: Opts; defaultEmployee?: string }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("hours.addManual")} description={t("hours.correctionNote")} action={addManualLog as FormAction}
      trigger={<Button variant="secondary"><Plus className="h-4 w-4" /> {t("hours.addManual")}</Button>}>
      <div className="space-y-4">
        <Select name="employee_id" label={t("common.employee")} options={opts.employees} defaultValue={defaultEmployee} placeholder="" required />
        <FormGrid>
          <Input name="started_at" type="datetime-local" label={t("hours.started")} required />
          <Input name="ended_at" type="datetime-local" label={t("hours.ended")} required />
        </FormGrid>
        <FormGrid>
          <Select name="project_id" label={t("common.project")} options={opts.projects} placeholder="" optional />
          <Select name="machine_id" label={t("common.machine")} options={opts.machines} placeholder="" optional />
        </FormGrid>
        <FormGrid>
          {opts.workTypes.length > 0 && <Select name="work_type" label={t("hours.workType")} options={opts.workTypes} placeholder="" optional />}
          <Input name="break_minutes" type="number" min={0} max={600} step={5} label={t("hours.breakMinutes")} optional />
        </FormGrid>
        <Textarea name="notes" label={t("common.notes")} optional />
      </div>
    </FormDialog>
  );
}

export type CorrectValues = { id: string; started: string; ended: string; project_id: string | null; machine_id: string | null; work_type: string | null; notes: string | null };

export function CorrectDialog({ opts, v }: { opts: Opts; v: CorrectValues }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("hours.correctTitle")} description={t("hours.correctionNote")} action={correctWorkLog.bind(null, v.id) as FormAction}
      trigger={<Button size="xs" variant="ghost" aria-label={t("hours.correct")}><Pencil className="h-3.5 w-3.5" /></Button>}>
      <div className="space-y-4">
        <FormGrid>
          <Input name="started_at" type="datetime-local" label={t("hours.started")} defaultValue={v.started} required />
          <Input name="ended_at" type="datetime-local" label={t("hours.ended")} defaultValue={v.ended} required />
        </FormGrid>
        <FormGrid>
          <Select name="project_id" label={t("common.project")} options={opts.projects} defaultValue={v.project_id ?? ""} placeholder="" optional />
          <Select name="machine_id" label={t("common.machine")} options={opts.machines} defaultValue={v.machine_id ?? ""} placeholder="" optional />
        </FormGrid>
        {opts.workTypes.length > 0 && <Select name="work_type" label={t("hours.workType")} options={opts.workTypes} defaultValue={v.work_type ?? ""} placeholder="" optional />}
        <Textarea name="notes" label={t("common.notes")} defaultValue={v.notes ?? ""} optional />
      </div>
    </FormDialog>
  );
}

export function CloseShiftDialog({ id, suggested }: { id: string; suggested: string }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("hours.closeShift")} description={t("hours.correctionNote")} action={closeOpenShift.bind(null, id) as FormAction}
      trigger={<Button size="xs" variant="danger"><TimerOff className="h-3.5 w-3.5" /> {t("hours.closeShift")}</Button>}>
      <Input name="ended_at" type="datetime-local" label={t("hours.ended")} defaultValue={suggested} required />
    </FormDialog>
  );
}

export function ApproveButton({ ids, all }: { ids: string[]; all?: boolean }) {
  const { t } = useT();
  if (!ids.length) return null;
  return (
    <ActionButton action={approveWorkLogs as FormAction} fields={{ ids: ids.join(",") }} variant={all ? "primary" : "ghost"} size={all ? "md" : "xs"}
      confirm={all ? `${t("hours.approveAll")} (${ids.length})?` : undefined}>
      <CheckCheck className="h-4 w-4" /> {all ? `${t("hours.approveAll")} (${ids.length})` : t("hours.approve")}
    </ActionButton>
  );
}
