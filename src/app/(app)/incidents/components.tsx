"use client";

import { Crosshair, Loader2, Siren } from "lucide-react";
import { useState } from "react";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { utcToLocalInput } from "@/lib/format";
import { reportIncident } from "./actions";

export const INCIDENT_TYPES = ["injury", "near_miss", "property_damage", "environmental", "fire", "vehicle", "other"] as const;
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const INCIDENT_STATUSES = ["open", "investigating", "action_required", "resolved", "closed"] as const;

type Opts = { projects: Option[]; machines: Option[]; employees: Option[] };

function IncidentFields({ orgId, tz, options }: { orgId: string; tz: string; options: Opts }) {
  const { t, label } = useT();
  // Pre-generated id: photos can be uploaded (and linked) before the incident row exists; also the idempotency key.
  const [id] = useState(() => crypto.randomUUID());
  const [now] = useState(() => utcToLocalInput(new Date().toISOString(), tz));
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [uploaded, setUploaded] = useState(0);

  const locate = () => {
    if (!("geolocation" in navigator)) { toast(t("incidents.gpsFailed"), "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast(t("incidents.gpsAdded"), "ok");
      },
      () => { setLocating(false); toast(t("incidents.gpsFailed"), "error"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Input name="title" label={t("incidents.titleLabel")} required maxLength={200} autoFocus />
      <FormGrid cols={3}>
        <Select name="incident_type" label={t("incidents.typeLabel")} defaultValue="near_miss" required
          options={INCIDENT_TYPES.map((v) => ({ value: v, label: label("incidents.type", v) }))} />
        <Select name="severity" label={t("incidents.severityLabel")} defaultValue="medium" required
          options={INCIDENT_SEVERITIES.map((v) => ({ value: v, label: label("incidents.severity", v) }))} />
        <Input name="occurred_at" type="datetime-local" label={t("incidents.occurredAt")} defaultValue={now} max={now} required />
      </FormGrid>
      <FormGrid cols={3}>
        <Select name="project_id" label={t("common.project")} options={options.projects} placeholder="" optional />
        <Select name="machine_id" label={t("common.machine")} options={options.machines} placeholder="" optional />
        <Select name="employee_id" label={t("incidents.involvedEmployee")} options={options.employees} placeholder="" optional />
      </FormGrid>
      <fieldset className="space-y-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-xs uppercase tracking-wider text-muted">{t("incidents.location")}</legend>
        <Input name="location_text" label={t("common.location")} maxLength={300} optional />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input name="latitude" type="number" step="0.000001" min={-90} max={90} label={t("incidents.latitude")} value={lat} onChange={(e) => setLat(e.target.value)} optional />
          <Input name="longitude" type="number" step="0.000001" min={-180} max={180} label={t("incidents.longitude")} value={lng} onChange={(e) => setLng(e.target.value)} optional />
          <Button variant="secondary" onClick={locate} disabled={locating} className="col-span-2 h-11 sm:col-span-1">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} {t("incidents.useGps")}
          </Button>
        </div>
      </fieldset>
      <Textarea name="description" label={t("incidents.description")} rows={4} required maxLength={5000} />
      <Textarea name="immediate_action" label={t("incidents.immediateAction")} rows={3} maxLength={5000} optional />
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">{t("common.photos")} / {t("common.video")}</div>
        <FileUploader orgId={orgId} entityType="incident" entityId={id} bucket="media" kind="photo" accept="image/*,video/*"
          onUploaded={(ids) => setUploaded((n) => n + ids.length)} />
        <p className="text-xs text-faint">{uploaded > 0 ? t("incidents.photosAdded", { n: uploaded }) : t("incidents.photosHint")}</p>
      </div>
    </div>
  );
}

export function ReportIncidentDialog({ orgId, tz, options, defaultOpen, compact }: { orgId: string; tz: string; options: Opts; defaultOpen?: boolean; compact?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="lg" title={t("incidents.new")} action={reportIncident as FormAction} defaultOpen={defaultOpen} submitLabel={t("incidents.new")}
      successMessage={t("incidents.reported")}
      trigger={<Button variant={compact ? "secondary" : "danger"}><Siren className="h-4 w-4" /> {t("incidents.new")}</Button>}>
      <IncidentFields orgId={orgId} tz={tz} options={options} />
    </FormDialog>
  );
}
