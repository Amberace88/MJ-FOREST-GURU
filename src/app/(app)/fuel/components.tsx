"use client";

import { Fuel, Receipt } from "lucide-react";
import { useState } from "react";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { useFuelTypeOptions } from "../machines/components";
import { createFuelLog } from "./actions";

const CURRENCIES: Option[] = ["EUR", "SEK", "ISK"].map((c) => ({ value: c, label: c }));

export type MachineMeta = Record<string, { projectId: string | null; engineHours: number | null; fuelType: string | null }>;

type Props = {
  orgId: string; machines: Option[]; projects: Option[]; employees: Option[] | null; fuelTypes: Option[]; machineMeta: MachineMeta;
  defaultMachineId?: string | null; defaultCurrency: string; nowLocal: string; ownEmployeeId?: string | null;
};

function newKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function toNum(v: string) {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

function FuelFields({ orgId, machines, projects, employees, fuelTypes, machineMeta, defaultMachineId, defaultCurrency, nowLocal, ownEmployeeId }: Props) {
  const { t } = useT();
  const [key] = useState(newKey);
  const initialMachine = defaultMachineId && machineMeta[defaultMachineId] ? defaultMachineId : "";
  const [machineId, setMachineId] = useState(initialMachine);
  const [projectId, setProjectId] = useState(initialMachine ? machineMeta[initialMachine]?.projectId ?? "" : "");
  const [fuelType, setFuelType] = useState(initialMachine ? machineMeta[initialMachine]?.fuelType ?? "diesel" : "diesel");
  const [litres, setLitres] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [receipt, setReceipt] = useState<string | null>(null);
  const fuelOpts = useFuelTypeOptions(fuelTypes, fuelType);
  const meta = machineId ? machineMeta[machineId] : undefined;

  const l = toNum(litres);
  const p = toNum(price);
  const tot = toNum(total);
  const derivedTotal = l != null && p != null && tot == null ? l * p : null;
  const derivedPrice = l != null && l > 0 && tot != null && p == null ? tot / l : null;

  return (
    <div className="space-y-4">
      <input type="hidden" name="idempotency_key" value={key} />
      {receipt && <input type="hidden" name="receipt_file_id" value={receipt} />}

      <FormGrid cols={2}>
        <Select name="machine_id" label={t("common.machine")} options={machines} placeholder="" required value={machineId}
          onChange={(e) => {
            const id = e.target.value;
            setMachineId(id);
            const m = machineMeta[id];
            if (m?.projectId && !projectId) setProjectId(m.projectId);
            if (m?.fuelType) setFuelType(m.fuelType);
          }} />
        <Select name="project_id" label={t("common.project")} options={projects} placeholder="" optional value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        <Input name="occurred_at" type="datetime-local" label={`${t("common.date")} / ${t("common.time")}`} defaultValue={nowLocal} max={nowLocal} required />
        {employees ? (
          <Select name="employee_id" label={t("common.employee")} options={employees} placeholder="" defaultValue={ownEmployeeId ?? ""} optional />
        ) : (
          <Select name="fuel_type" label={t("fuel.fuelType")} options={fuelOpts} value={fuelType} onChange={(e) => setFuelType(e.target.value)} />
        )}
      </FormGrid>

      <div className="rounded-xl border border-line bg-surface-2/40 p-4">
        <FormGrid cols={3}>
          <Input name="litres" type="number" inputMode="decimal" step="0.01" min={0.01} max={5000} label={t("fuel.litres")} required
            value={litres} onChange={(e) => setLitres(e.target.value)} className="[&_input]:text-lg [&_input]:font-semibold" />
          <Input name="price_per_litre" type="number" inputMode="decimal" step="0.0001" min={0} label={t("fuel.pricePerLitre")} optional
            value={price} onChange={(e) => setPrice(e.target.value)}
            hint={derivedPrice != null ? `≈ ${fmtNumber(derivedPrice, 3)} / L` : undefined} />
          <Input name="total_amount" type="number" inputMode="decimal" step="0.01" min={0} label={t("fuel.totalAmount")} optional
            value={total} onChange={(e) => setTotal(e.target.value)}
            hint={derivedTotal != null ? `= ${fmtMoney(derivedTotal, currency)}` : t("fuel.priceOrTotal")} />
        </FormGrid>
        <FormGrid cols={3} className="mt-4">
          <Select name="currency" label={t("common.currency")} options={CURRENCIES} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          {employees && <Select name="fuel_type" label={t("fuel.fuelType")} options={fuelOpts} value={fuelType} onChange={(e) => setFuelType(e.target.value)} />}
          <Input name="location_text" label={t("fuel.station")} maxLength={200} optional />
        </FormGrid>
      </div>

      <FormGrid cols={2}>
        <Input name="engine_hours" type="number" inputMode="decimal" step="0.1" min={0} label={t("fuel.engineHours")} optional
          hint={meta?.engineHours != null ? t("fuel.lastReading", { h: fmtNumber(meta.engineHours, 1) }) : t("fuel.engineHoursHint")} />
        <Input name="mileage_km" type="number" inputMode="decimal" step="0.1" min={0} label={t("fuel.mileage")} optional />
      </FormGrid>
      <Textarea name="notes" label={t("common.notes")} rows={2} maxLength={2000} optional />

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
          <span className="flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> {t("fuel.receiptPhoto")}</span>
          {receipt && <span className="normal-case tracking-normal text-moss">{t("fuel.receiptAttached")}</span>}
        </div>
        {!receipt && (
          <FileUploader orgId={orgId} entityType="fuel" entityId={null} bucket="receipts" kind="receipt" accept="image/*,application/pdf" multiple={false}
            label={t("fuel.addReceipt")} onUploaded={(ids) => setReceipt(ids[0] ?? null)} />
        )}
      </div>
    </div>
  );
}

export function NewFuelDialog({ defaultOpen, ...props }: Props & { defaultOpen?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("fuel.new")} action={createFuelLog as FormAction} defaultOpen={defaultOpen}
      trigger={<Button variant="amber"><Fuel className="h-4 w-4" /> {t("fuel.new")}</Button>}>
      <FuelFields {...props} />
    </FormDialog>
  );
}
