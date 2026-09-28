"use client";

import { Check, CornerUpLeft, Pencil, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm, FormDialog, FormGrid, Input, Select, SubmitButton, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { CURRENCIES, type ReceiptFormOptions } from "../receipts/types";
import { ReceiptPhotoField } from "../receipts/upload";
import { createExpense, decideExpense, updateExpense } from "./actions";

export const EXPENSE_CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"] as const;

export type ExpenseValues = {
  id: string; expense_date: string; amount: number; currency: string; category: string; project_id: string | null;
  machine_id: string | null; employee_id: string | null; description: string | null;
  receipt: { id: string; url: string | null; label: string } | null;
};

type FieldsProps = {
  orgId: string; options: ReceiptFormOptions; defaultCurrency: string; today: string;
  employees?: Option[]; defaultEmployeeId?: string | null; values?: ExpenseValues; defaultProjectId?: string;
};

function ExpenseFields({ orgId, options, defaultCurrency, today, employees, defaultEmployeeId, values, defaultProjectId }: FieldsProps) {
  const { t, label } = useT();
  const initialProject = values?.project_id ?? defaultProjectId ?? "";
  const [currency, setCurrency] = useState<string>(values?.currency || (initialProject ? options.projectCurrency[initialProject] : "") || defaultCurrency);
  const [touched, setTouched] = useState(Boolean(values));
  return (
    <div className="space-y-4">
      <FormGrid cols={3}>
        <Input name="expense_date" type="date" label={t("common.date")} defaultValue={values?.expense_date ?? today} max={today} required />
        <Input name="amount" type="number" inputMode="decimal" step="0.01" min={0.01} label={t("common.amount")} defaultValue={values?.amount ?? ""} required />
        <Select name="currency" label={t("common.currency")} value={currency} required
          onChange={(e) => { setCurrency(e.target.value); setTouched(true); }} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </FormGrid>
      <FormGrid cols={2}>
        <Select name="category" label={t("common.category")} defaultValue={values?.category ?? ""} placeholder="" required
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: label("expenses.categories", c) }))} />
        {employees ? (
          <Select name="employee_id" label={t("common.employee")} defaultValue={values?.employee_id ?? defaultEmployeeId ?? ""} options={employees} placeholder="" optional />
        ) : <div className="hidden sm:block" />}
      </FormGrid>
      <FormGrid cols={2}>
        <Select name="project_id" label={t("common.project")} defaultValue={initialProject} options={options.projects} placeholder="" optional
          onChange={(e) => { const c = options.projectCurrency[e.target.value]; if (c && !touched) setCurrency(c); }} />
        <Select name="machine_id" label={t("common.machine")} defaultValue={values?.machine_id ?? ""} options={options.machines} placeholder="" optional />
      </FormGrid>
      <Textarea name="description" label={t("common.description")} defaultValue={values?.description ?? ""} rows={3} maxLength={2000}
        hint={t("expenses.descriptionHint")} optional />
      <ReceiptPhotoField orgId={orgId} existing={values?.receipt ?? null} />
    </div>
  );
}

export function NewExpenseDialog(props: Omit<FieldsProps, "values"> & { defaultOpen?: boolean }) {
  const { t } = useT();
  const { defaultOpen, ...fields } = props;
  return (
    <FormDialog size="lg" title={t("expenses.new")} description={t("expenses.newHint")} action={createExpense as FormAction} defaultOpen={defaultOpen}
      submitLabel={t("expenses.saveDraft")}
      footer={<SubmitButton name="intent" value="submit" variant="amber"><Send className="h-4 w-4" /> {t("expenses.submit")}</SubmitButton>}
      trigger={<Button><Plus className="h-4 w-4" /> {t("expenses.new")}</Button>}>
      <ExpenseFields {...fields} />
    </FormDialog>
  );
}

export function EditExpenseDialog(props: FieldsProps & { values: ExpenseValues }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("common.edit")} action={updateExpense.bind(null, props.values.id) as FormAction}
      submitLabel={t("common.save")}
      footer={<SubmitButton name="intent" value="submit" variant="amber"><Send className="h-4 w-4" /> {t("expenses.resubmit")}</SubmitButton>}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <ExpenseFields {...props} />
    </FormDialog>
  );
}

/** Approver panel: approve (comment optional) / reject or request correction (comment required). */
export function DecisionPanel({ expenseId }: { expenseId: string }) {
  const { t } = useT();
  return (
    <ActionForm action={decideExpense.bind(null, expenseId) as FormAction} className="space-y-3">
      <Textarea name="comment" label={t("expenses.decisionComment")} rows={3} maxLength={2000} hint={t("expenses.commentHint")} />
      <div className="grid gap-2 sm:grid-cols-3">
        <SubmitButton name="decision" value="approved" className="w-full"><Check className="h-4 w-4" /> {t("expenses.approve")}</SubmitButton>
        <SubmitButton name="decision" value="correction_requested" variant="secondary" className="w-full"><CornerUpLeft className="h-4 w-4" /> {t("expenses.requestCorrection")}</SubmitButton>
        <SubmitButton name="decision" value="rejected" variant="danger" className="w-full"><X className="h-4 w-4" /> {t("expenses.reject")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
