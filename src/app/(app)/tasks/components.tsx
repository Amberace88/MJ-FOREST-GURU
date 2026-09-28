"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { createTask, updateTask } from "./actions";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type TaskFormOptions = { projects: Option[]; machines: Option[]; employees: Option[]; teams: Option[] };
export type TaskValues = {
  id: string; title: string; description: string | null; project_id: string | null; machine_id: string | null; team_id: string | null;
  assignee_employee_id: string | null; priority: string; deadlineLocal: string;
};

function TaskFields({ options, canManage, values, defaultProjectId }: { options: TaskFormOptions; canManage: boolean; values?: TaskValues; defaultProjectId?: string }) {
  const { t, label } = useT();
  return (
    <div className="space-y-4">
      <Input name="title" label={t("tasks.titleLabel")} defaultValue={values?.title} required maxLength={200} autoFocus />
      <Textarea name="description" label={t("common.description")} defaultValue={values?.description ?? ""} rows={3} maxLength={4000} optional />
      <FormGrid cols={2}>
        <Select name="project_id" label={t("common.project")} defaultValue={values?.project_id ?? defaultProjectId ?? ""} options={options.projects} placeholder="" optional />
        <Select name="machine_id" label={t("common.machine")} defaultValue={values?.machine_id ?? ""} options={options.machines} placeholder="" optional />
      </FormGrid>
      {canManage ? (
        <FormGrid cols={2}>
          <Select name="assignee_employee_id" label={t("tasks.assignee")} defaultValue={values?.assignee_employee_id ?? ""} options={options.employees} placeholder="" optional />
          <Select name="team_id" label={t("common.team")} defaultValue={values?.team_id ?? ""} options={options.teams} placeholder="" optional />
        </FormGrid>
      ) : (
        <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-xs text-muted">{t("tasks.selfAssignedHint")}</p>
      )}
      <FormGrid cols={2}>
        <Select name="priority" label={t("common.priority")} defaultValue={values?.priority ?? "medium"}
          options={PRIORITIES.map((p) => ({ value: p, label: label("tasks.priority", p) }))} />
        <Input name="deadline" type="datetime-local" label={t("common.deadline")} defaultValue={values?.deadlineLocal ?? ""} optional />
      </FormGrid>
    </div>
  );
}

export function NewTaskDialog({ options, canManage, defaultOpen, defaultProjectId }: { options: TaskFormOptions; canManage: boolean; defaultOpen?: boolean; defaultProjectId?: string }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("tasks.new")} action={createTask as FormAction} defaultOpen={defaultOpen} submitLabel={t("common.create")}
      trigger={<Button><Plus className="h-4 w-4" /> {t("tasks.new")}</Button>}>
      <TaskFields options={options} canManage={canManage} defaultProjectId={defaultProjectId} />
    </FormDialog>
  );
}

export function EditTaskDialog({ options, values }: { options: TaskFormOptions; values: TaskValues }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("common.edit")} action={updateTask.bind(null, values.id) as FormAction}
      trigger={<Button variant="secondary" size="sm"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <TaskFields options={options} canManage values={values} />
    </FormDialog>
  );
}
