"use client";

import { Plus, ShieldAlert, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm, FormGrid, Input, Select, SubmitButton, Textarea, type FormAction } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { confirmReceipt } from "./actions";
import { CURRENCIES, type ReceiptFormOptions } from "./types";
import { ReceiptCaptureButtons } from "./upload";

const EXPENSE_CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"] as const;

/** "Pievienot čeku": step 1 = photo; step 2 (confirmation) opens as /receipts?receipt=<id>. */
export function AddReceiptDialog({ orgId, defaultOpen }: { orgId: string; defaultOpen?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  useEffect(() => { if (defaultOpen) open(); }, [defaultOpen]);
  return (
    <>
      <Button onClick={open}><Plus className="h-4 w-4" /> {t("receipts.new")}</Button>
      <dialog ref={ref} aria-labelledby="add-receipt-title" onClick={(e) => { if (e.target === ref.current) close(); }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="add-receipt-title" className="font-display text-xl font-semibold uppercase tracking-wide">{t("receipts.new")}</h2>
            <p className="mt-1 text-sm text-muted">{t("receipts.photoStepHint")}</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">
          <ReceiptCaptureButtons orgId={orgId} onUploaded={(r) => {
            if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
            close();
            router.push(`/receipts?receipt=${r.receiptId}`, { scroll: false });
          }} />
          <p className="mt-4 flex items-start gap-2 text-xs text-faint"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("receipts.privateNote")}</p>
        </div>
      </dialog>
    </>
  );
}

export type ReceiptDefaults = {
  merchant: string | null; date: string | null; amount: number | null; vat: number | null; currency: string | null;
};

/**
 * Confirmation form. Values are prefilled from OCR only when OCR data exists;
 * nothing becomes trusted until the user presses "confirm".
 */
export function ReceiptConfirmForm({ receiptId, defaults, fromOcr, confirmed, options, defaultCurrency, canExpense, canFuel, readOnly }: {
  receiptId: string; defaults: ReceiptDefaults; fromOcr: boolean; confirmed: boolean; options: ReceiptFormOptions; defaultCurrency: string;
  canExpense: boolean; canFuel: boolean; readOnly: boolean;
}) {
  const { t, label } = useT();
  const [create, setCreate] = useState<string>("none");
  const [currency, setCurrency] = useState<string>(defaults.currency ?? defaultCurrency);
  const [currencyTouched, setCurrencyTouched] = useState(Boolean(defaults.currency));
  const creating = create !== "none";
  const createOptions = [
    { value: "none", label: t("receipts.createNone") },
    ...(canExpense ? [{ value: "expense_draft", label: t("receipts.createExpenseDraft") }, { value: "expense_submit", label: t("receipts.createExpenseSubmit") }] : []),
    ...(canFuel ? [{ value: "fuel", label: t("receipts.createFuel") }] : []),
  ];

  return (
    <ActionForm action={confirmReceipt.bind(null, receiptId) as FormAction} className="space-y-4">
      {!confirmed && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-3 text-sm">
          <p className="font-medium text-amber">{t("receipts.confirmTitle")}</p>
          <p className="mt-0.5 text-ink-2">{t("receipts.confirmHint")}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            {fromOcr ? <><Sparkles className="h-3.5 w-3.5 text-amber" /> {t("receipts.ocrPrefilled")}</> : t("receipts.noOcr")}
          </p>
        </div>
      )}
      <fieldset disabled={readOnly} className="space-y-4">
        <FormGrid cols={2}>
          <Input name="merchant" label={t("receipts.merchant")} defaultValue={defaults.merchant ?? ""} maxLength={200} optional autoComplete="off" />
          <Input name="receipt_date" type="date" label={t("common.date")} defaultValue={defaults.date ?? ""} optional={!creating} required={creating} />
        </FormGrid>
        <FormGrid cols={3}>
          <Input name="amount" type="number" inputMode="decimal" step="0.01" min={0} label={t("receipts.total")} defaultValue={defaults.amount ?? ""} optional={!creating} required={creating} />
          <Input name="vat_amount" type="number" inputMode="decimal" step="0.01" min={0} label={t("receipts.vat")} defaultValue={defaults.vat ?? ""} optional />
          <Select name="currency" label={t("common.currency")} value={currency} onChange={(e) => { setCurrency(e.target.value); setCurrencyTouched(true); }}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} required />
        </FormGrid>

        {createOptions.length > 1 && (
          <div className="rounded-xl border border-line bg-surface-2/40 p-4">
            <Select name="create" label={t("receipts.createFromReceipt")} value={create} onChange={(e) => setCreate(e.target.value)} options={createOptions} />
            {creating && (
              <div className="mt-4 space-y-4 animate-fade-up">
                <FormGrid cols={2}>
                  {create !== "fuel" && (
                    <Select name="category" label={t("common.category")} required placeholder="" defaultValue=""
                      options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: label("expenses.categories", c) }))} />
                  )}
                  {create === "fuel" && (
                    <Input name="litres" type="number" inputMode="decimal" step="0.01" min={0.01} max={5000} label={t("fuel.litres")} required />
                  )}
                  <Select name="project_id" label={t("common.project")} options={options.projects} placeholder="" optional
                    onChange={(e) => { const c = options.projectCurrency[e.target.value]; if (c && !currencyTouched) setCurrency(c); }} />
                </FormGrid>
                <FormGrid cols={2}>
                  <Select name="machine_id" label={t("common.machine")} options={options.machines} placeholder="" optional />
                  {create === "fuel" && options.fuelTypes.length > 0 && (
                    <Select name="fuel_type" label={t("fuel.fuelType")} options={options.fuelTypes} defaultValue={options.fuelTypes[0]?.value} />
                  )}
                </FormGrid>
                <Textarea name="description" label={t("common.description")} rows={2} maxLength={2000} optional />
              </div>
            )}
          </div>
        )}
      </fieldset>
      {!readOnly && (
        <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4")}>
          <SubmitButton variant={confirmed ? "secondary" : "amber"}>{confirmed && !creating ? t("common.save") : t("receipts.confirmAndSave")}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
