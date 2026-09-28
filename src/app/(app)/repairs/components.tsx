"use client";

import { CircleCheck, LocateFixed, Loader2, MapPinCheck, Package, Pencil, TriangleAlert, UserCog } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { addRepairPart, assignMechanic, createRepair, saveRepairWork } from "./actions";
import { REPAIR_PRIORITIES } from "./workflow";

const CURRENCIES: Option[] = ["EUR", "SEK", "ISK"].map((c) => ({ value: c, label: c }));
const FALLBACK_CATEGORIES = ["engine", "hydraulics", "electrical", "tracks_tyres", "crane", "harvester_head", "cabin", "leak", "other"] as const;

function newKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const PRIORITY_STYLE: Record<string, string> = {
  low: "has-[:checked]:border-off has-[:checked]:bg-off/15",
  medium: "has-[:checked]:border-info has-[:checked]:bg-info/12",
  high: "has-[:checked]:border-amber has-[:checked]:bg-amber/12",
  critical: "has-[:checked]:border-crit has-[:checked]:bg-crit/15",
};

/* ------------------------------------------------------------------ report a problem */
type ReportProps = {
  orgId: string; machines: Option[]; projects: Option[]; categories: Option[];
  /** machine id → its current project id, to prefill the project */
  machineProjects?: Record<string, string | null>;
  defaultMachineId?: string | null; defaultProjectId?: string | null;
};

function ReportFields({ orgId, machines, projects, categories, machineProjects, defaultMachineId, defaultProjectId }: ReportProps) {
  const { t, label } = useT();
  const [key] = useState(newKey);
  const [machineId, setMachineId] = useState(defaultMachineId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? (defaultMachineId ? machineProjects?.[defaultMachineId] ?? "" : ""));
  const [photos, setPhotos] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const cats = categories.length ? categories : FALLBACK_CATEGORIES.map((k) => ({ value: k, label: label("repairs.categories", k) }));

  const locate = () => {
    if (!("geolocation" in navigator)) { toast(t("repairs.locationFailed"), "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); setLocating(false); },
      () => { toast(t("repairs.locationFailed"), "error"); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="idempotency_key" value={key} />
      {photos.map((id) => <input key={id} type="hidden" name="photo_ids[]" value={id} />)}
      {geo && <><input type="hidden" name="latitude" value={geo.lat} /><input type="hidden" name="longitude" value={geo.lng} /></>}

      <Select name="machine_id" label={t("common.machine")} options={machines} placeholder="" required value={machineId}
        onChange={(e) => {
          setMachineId(e.target.value);
          const p = machineProjects?.[e.target.value];
          if (p && !projectId) setProjectId(p);
        }} />
      <FormGrid cols={2}>
        <Select name="category" label={t("repairs.problemCategory")} options={cats} placeholder="" required />
        <Select name="project_id" label={t("common.project")} options={projects} placeholder="" optional value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      </FormGrid>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("common.priority")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REPAIR_PRIORITIES.map((p) => (
            <label key={p} className={cn("flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/40 px-3 text-sm font-medium transition-colors", PRIORITY_STYLE[p])}>
              <input type="radio" name="priority" value={p} defaultChecked={p === "medium"} className="sr-only" />
              {p === "critical" && <TriangleAlert className="h-4 w-4 text-crit" />}
              {label("repairs.priority", p)}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-faint">{t("repairs.criticalHint")}</p>
      </fieldset>

      <Input name="title" label={t("repairs.titleLabel")} required maxLength={200} placeholder={t("repairs.titlePlaceholder")} />
      <Textarea name="description" label={t("common.description")} rows={4} maxLength={4000} optional />

      <FormGrid cols={2}>
        <Input name="location_text" label={t("common.location")} maxLength={200} optional />
        <div className="flex items-end">
          <Button variant={geo ? "secondary" : "outline"} className="h-10 w-full" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : geo ? <MapPinCheck className="h-4 w-4 text-moss" /> : <LocateFixed className="h-4 w-4" />}
            {geo ? t("repairs.locationAdded", { m: geo.acc }) : t("repairs.addLocation")}
          </Button>
        </div>
      </FormGrid>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted">
          <span>{t("repairs.photosBefore")}</span>
          {photos.length > 0 && <span className="normal-case tracking-normal text-moss">{t("repairs.photosAttached", { n: photos.length })}</span>}
        </div>
        <FileUploader orgId={orgId} entityType="repair" entityId={null} kind="before" accept="image/*,video/*" label={t("repairs.addPhotos")}
          onUploaded={(ids) => setPhotos((prev) => [...prev, ...ids])} />
      </div>
    </div>
  );
}

export function ReportProblemDialog({ defaultOpen, triggerVariant = "amber", triggerSize = "md", triggerLabel, ...props }: ReportProps & {
  defaultOpen?: boolean; triggerVariant?: ButtonVariant; triggerSize?: ButtonSize; triggerLabel?: ReactNode;
}) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("repairs.reportTitle")} description={t("repairs.reportHint")} action={createRepair as FormAction} defaultOpen={defaultOpen}
      submitLabel={t("common.send")}
      trigger={<Button variant={triggerVariant} size={triggerSize}><TriangleAlert className="h-4 w-4" /> {triggerLabel ?? t("repairs.new")}</Button>}>
      <ReportFields {...props} />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ mechanic */
export function AssignMechanicDialog({ repairId, options, current }: { repairId: string; options: Option[]; current?: string | null }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("repairs.assignMechanic")} action={assignMechanic.bind(null, repairId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><UserCog className="h-4 w-4" /> {current ? t("repairs.changeMechanic") : t("repairs.assignMechanic")}</Button>}>
      <Select name="assigned_mechanic_id" label={t("repairs.mechanic")} options={options} placeholder="" defaultValue={current ?? ""} required />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ parts */
export function AddPartDialog({ repairId, defaultCurrency }: { repairId: string; defaultCurrency: string }) {
  const { t } = useT();
  return (
    <FormDialog size="sm" title={t("repairs.addPart")} action={addRepairPart.bind(null, repairId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><Package className="h-4 w-4" /> {t("repairs.addPart")}</Button>}>
      <div className="space-y-4">
        <Input name="name" label={t("repairs.partName")} required maxLength={200} />
        <FormGrid cols={2}>
          <Input name="part_number" label={t("repairs.partNumber")} maxLength={100} optional />
          <Input name="supplier" label={t("repairs.supplier")} maxLength={200} optional />
          <Input name="quantity" type="number" inputMode="decimal" step="0.01" min={0.01} label={t("repairs.quantity")} defaultValue="1" required />
          <Input name="unit_cost" type="number" inputMode="decimal" step="0.01" min={0} label={t("repairs.unitCost")} optional />
          <Select name="currency" label={t("common.currency")} options={CURRENCIES} defaultValue={defaultCurrency} />
        </FormGrid>
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ work / completion */
export type RepairWorkValues = {
  labour_hours: number | null; labour_cost: number | null; external_cost: number | null; currency: string;
  downtime_hours: number | null; external_service: string | null; resolution: string | null;
};

export function RepairWorkDialog({ repairId, values, complete, downtimeAuto }: { repairId: string; values: RepairWorkValues; complete?: boolean; downtimeAuto?: boolean }) {
  const { t } = useT();
  const n = (v: number | null) => (v == null ? "" : String(v));
  return (
    <FormDialog size="md" title={complete ? t("repairs.complete") : t("repairs.workAndCosts")} action={saveRepairWork.bind(null, repairId, !!complete) as FormAction}
      submitLabel={complete ? t("repairs.complete") : undefined}
      trigger={complete
        ? <Button><CircleCheck className="h-4 w-4" /> {t("repairs.complete")}</Button>
        : <Button size="sm" variant="secondary"><Pencil className="h-4 w-4" /> {t("repairs.workAndCosts")}</Button>}>
      <div className="space-y-4">
        <Textarea name="resolution" label={t("repairs.resolution")} rows={4} maxLength={4000} defaultValue={values.resolution ?? ""} required={complete} optional={!complete} />
        <FormGrid cols={2}>
          <Input name="labour_hours" type="number" inputMode="decimal" step="0.25" min={0} label={t("repairs.labourHours")} defaultValue={n(values.labour_hours)} optional />
          <Input name="labour_cost" type="number" inputMode="decimal" step="0.01" min={0} label={t("repairs.labourCost")} defaultValue={n(values.labour_cost)} optional />
          <Input name="external_service" label={t("maintenance.externalService")} maxLength={200} defaultValue={values.external_service ?? ""} optional />
          <Input name="external_cost" type="number" inputMode="decimal" step="0.01" min={0} label={t("repairs.externalCost")} defaultValue={n(values.external_cost)} optional />
          <Select name="currency" label={t("common.currency")} options={CURRENCIES} defaultValue={values.currency} />
          <Input name="downtime_hours" type="number" inputMode="decimal" step="0.25" min={0} label={t("repairs.downtime")} defaultValue={n(values.downtime_hours)} optional
            hint={downtimeAuto ? t("repairs.downtimeAutoHint") : undefined} />
        </FormGrid>
      </div>
    </FormDialog>
  );
}
