"use client";

import { AlertOctagon, Camera, CheckCircle2, ChevronLeft, Fuel, Loader2, MapPin, Receipt, TreePine, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormGrid, Input, Select, Textarea, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { compressImage, enqueue, flush, getPosition, newId, type QueueEventType, type QueuedFile } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";

export type ReportKind = "fuel" | "expense" | "repair" | "photo" | "incident" | "production";

const TILES: Record<ReportKind, { Icon: typeof Fuel; tone: string }> = {
  fuel: { Icon: Fuel, tone: "from-amber/30 text-amber" },
  expense: { Icon: Receipt, tone: "from-info/30 text-info" },
  repair: { Icon: Wrench, tone: "from-crit/30 text-crit" },
  photo: { Icon: Camera, tone: "from-forest-500/30 text-moss" },
  incident: { Icon: AlertOctagon, tone: "from-warn/30 text-warn" },
  production: { Icon: TreePine, tone: "from-wood-500/40 text-wood-300" },
};

type Props = {
  orgId: string; userId: string; initial: ReportKind | null; allowed: ReportKind[]; currency: "EUR" | "SEK" | "ISK";
  defaults: { projectId: string | null; machineId: string | null };
  projects: Option[]; machines: Option[]; fuelTypes: Option[]; problemCategories: Option[]; expenseCategories: Option[];
};

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}
function localNowInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
/** datetime-local is in the DEVICE zone (the worker is on site) → UTC ISO */
function deviceLocalToIso(v: string | null) {
  return v ? new Date(v).toISOString() : new Date().toISOString();
}

export function ReportHub(p: Props) {
  const { t, label } = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ReportKind | null>(p.initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "sent" | "queued">(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function choose(k: ReportKind | null) {
    setKind(k); setDone(null); setPhotos([]); setPos(null);
    router.replace(k ? `/report?type=${k}` : "/report", { scroll: false });
  }

  async function locate() {
    setLocating(true);
    const r = await getPosition(8000);
    setLocating(false);
    if (r) setPos({ lat: r.lat, lng: r.lng }); else toast(t("work.gpsOff"), "error");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kind) return;
    const fd = new FormData(e.currentTarget);
    let type: QueueEventType = kind;
    let payload: Record<string, unknown> = {};
    const fileField = kind === "fuel" || kind === "expense" ? "receipt" : "photo";

    switch (kind) {
      case "fuel": {
        const litres = num(fd.get("litres"));
        if (!str(fd.get("machineId")) || !litres) { toast(t("errors.validation"), "error"); return; }
        payload = { machineId: str(fd.get("machineId")), projectId: str(fd.get("projectId")), occurredAt: deviceLocalToIso(str(fd.get("occurredAt"))), litres,
          totalAmount: num(fd.get("totalAmount")), currency: fd.get("currency"), fuelType: fd.get("fuelType") || "diesel", engineHours: num(fd.get("engineHours")),
          location: str(fd.get("location")), lat: pos?.lat ?? null, lng: pos?.lng ?? null, notes: str(fd.get("notes")) };
        break;
      }
      case "expense": {
        const amount = num(fd.get("amount"));
        if (!amount) { toast(t("errors.validation"), "error"); return; }
        if (!photos.length && !str(fd.get("description"))) { toast(t("errors.incompleteExpense"), "error"); return; }
        payload = { expenseDate: String(fd.get("expenseDate") || new Date().toISOString().slice(0, 10)), amount, currency: fd.get("currency"), category: fd.get("category"),
          projectId: str(fd.get("projectId")), machineId: str(fd.get("machineId")), description: str(fd.get("description")), submit: true };
        break;
      }
      case "repair": {
        if (!str(fd.get("machineId")) || !str(fd.get("title"))) { toast(t("errors.validation"), "error"); return; }
        payload = { machineId: str(fd.get("machineId")), projectId: str(fd.get("projectId")), category: fd.get("category") || "other", priority: fd.get("priority") || "medium",
          title: str(fd.get("title")), description: str(fd.get("description")), lat: pos?.lat ?? null, lng: pos?.lng ?? null };
        break;
      }
      case "incident": {
        if (!str(fd.get("title")) || !str(fd.get("description"))) { toast(t("errors.validation"), "error"); return; }
        payload = { occurredAt: deviceLocalToIso(str(fd.get("occurredAt"))), severity: fd.get("severity") || "medium", incidentType: fd.get("incidentType") || "other",
          title: str(fd.get("title")), description: str(fd.get("description")), immediateAction: str(fd.get("immediateAction")),
          projectId: str(fd.get("projectId")), machineId: str(fd.get("machineId")), lat: pos?.lat ?? null, lng: pos?.lng ?? null };
        break;
      }
      case "production": {
        const quantity = num(fd.get("quantity"));
        if (!str(fd.get("projectId")) || !quantity) { toast(t("errors.validation"), "error"); return; }
        payload = { projectId: str(fd.get("projectId")), machineId: str(fd.get("machineId")), date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
          quantity, unit: fd.get("unit") || "m3", unitLabel: str(fd.get("unitLabel")), notes: str(fd.get("notes")) };
        break;
      }
      case "photo": {
        const target = String(fd.get("target") ?? "");
        const [entityType, entityId] = target.split(":");
        if (!entityId || !photos.length) { toast(t("errors.validation"), "error"); return; }
        type = "photo";
        payload = { entityType, entityId, kind: "photo" };
        break;
      }
    }

    setBusy(true);
    try {
      const files: QueuedFile[] = [];
      for (const f of photos.slice(0, 8)) {
        const blob = await compressImage(f);
        files.push({ field: fileField, name: f.name || "foto.jpg", type: blob.type || f.type, blob });
      }
      await enqueue({ id: newId(), type, userId: p.userId, orgId: p.orgId, payload, files });
      if (navigator.onLine) {
        const r = await flush(p.userId);
        if (r.failed) { toast(t("work.failed"), "error"); setDone("queued"); }
        else { setDone(r.synced ? "sent" : "queued"); router.refresh(); }
      } else setDone("queued");
      setPhotos([]); setPos(null);
    } catch {
      toast(t("errors.generic"), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!kind) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {p.allowed.map((k, i) => {
          const { Icon, tone } = TILES[k];
          return (
            <button key={k} type="button" onClick={() => choose(k)} style={{ animationDelay: `${i * 40}ms` }}
              className="card card-hover group relative flex min-h-36 flex-col items-start justify-between overflow-hidden p-4 text-left animate-fade-up">
              <span className={cn("pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-xl", tone)} />
              <span className={cn("grid h-12 w-12 place-items-center rounded-xl bg-surface-3", tone.split(" ")[1])}><Icon className="h-6 w-6" /></span>
              <span>
                <span className="block font-display text-lg font-semibold uppercase tracking-wide">{label("report.kinds", k)}</span>
                <span className="mt-0.5 block text-xs text-muted">{label("report.hints", k)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center animate-fade-up">
        <CheckCircle2 className={cn("mx-auto h-14 w-14", done === "sent" ? "text-ok" : "text-warn")} />
        <h2 className="mt-4 font-display text-2xl font-bold uppercase tracking-wide">{done === "sent" ? t("report.sent") : t("work.offlineQueued")}</h2>
        <p className="mt-2 text-sm text-muted">{done === "sent" ? t("report.sentText") : t("work.savedOffline")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => setDone(null)}>{t("report.another")}</Button>
          <Button variant="ghost" onClick={() => choose(null)}>{t("report.title")}</Button>
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl px-4 text-sm text-ink-2 hover:bg-surface-2">{t("nav.dashboard")}</Link>
        </div>
      </div>
    );
  }

  const { Icon } = TILES[kind];
  const currencies = ["EUR", "SEK", "ISK"].map((c) => ({ value: c, label: c }));
  const priorities = ["low", "medium", "high", "critical"].map((x) => ({ value: x, label: label("repairs.priority", x) }));
  const photoLabel = kind === "fuel" || kind === "expense" ? t("receipts.takePhoto") : t("common.photos");

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl p-5 md:p-6 animate-fade-up">
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={() => choose(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:text-ink" aria-label={t("common.back")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Icon className="h-5 w-5 text-amber" />
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{label("report.kinds", kind)}</h2>
      </div>

      <div className="space-y-4">
        {kind === "fuel" && (<>
          <FormGrid>
            <Select name="machineId" label={t("common.machine")} options={p.machines} defaultValue={p.defaults.machineId ?? ""} placeholder="" required />
            <Select name="projectId" label={t("common.project")} options={p.projects} defaultValue={p.defaults.projectId ?? ""} placeholder="" optional />
          </FormGrid>
          <FormGrid cols={3}>
            <Input name="litres" type="number" inputMode="decimal" step="0.01" min={0.1} max={5000} label={t("fuel.litres")} required />
            <Input name="totalAmount" type="number" inputMode="decimal" step="0.01" min={0} label={t("fuel.totalAmount")} optional />
            <Select name="currency" label={t("common.currency")} options={currencies} defaultValue={p.currency} />
          </FormGrid>
          <FormGrid cols={3}>
            <Select name="fuelType" label={t("fuel.fuelType")} options={p.fuelTypes} />
            <Input name="engineHours" type="number" inputMode="decimal" step="0.1" min={0} label={t("fuel.engineHours")} optional />
            <Input name="occurredAt" type="datetime-local" label={t("common.time")} defaultValue={localNowInput()} />
          </FormGrid>
          <Input name="location" label={t("fuel.station")} optional />
        </>)}

        {kind === "expense" && (<>
          <FormGrid cols={3}>
            <Input name="amount" type="number" inputMode="decimal" step="0.01" min={0.01} label={t("common.amount")} required />
            <Select name="currency" label={t("common.currency")} options={currencies} defaultValue={p.currency} />
            <Input name="expenseDate" type="date" label={t("common.date")} defaultValue={new Date().toISOString().slice(0, 10)} />
          </FormGrid>
          <FormGrid>
            <Select name="category" label={t("common.category")} options={p.expenseCategories} />
            <Select name="projectId" label={t("common.project")} options={p.projects} defaultValue={p.defaults.projectId ?? ""} placeholder="" optional />
          </FormGrid>
          <Textarea name="description" label={t("common.description")} hint={t("report.expenseHint")} />
        </>)}

        {kind === "repair" && (<>
          <FormGrid>
            <Select name="machineId" label={t("common.machine")} options={p.machines} defaultValue={p.defaults.machineId ?? ""} placeholder="" required />
            <Select name="category" label={t("repairs.problemCategory")} options={p.problemCategories} />
          </FormGrid>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("common.priority")}</legend>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map((pr) => (
                <label key={pr.value} className="relative">
                  <input type="radio" name="priority" value={pr.value} defaultChecked={pr.value === "medium"} className="peer sr-only" />
                  <span className={cn("flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line text-sm peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-amber",
                    pr.value === "critical" ? "peer-checked:bg-crit peer-checked:text-white" : pr.value === "high" ? "peer-checked:bg-amber peer-checked:text-[#1b1406]" : "peer-checked:bg-forest-600 peer-checked:text-on-accent")}>{pr.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Input name="title" label={t("repairs.titleLabel")} required maxLength={200} />
          <Textarea name="description" label={t("common.description")} optional />
          <Select name="projectId" label={t("common.project")} options={p.projects} defaultValue={p.defaults.projectId ?? ""} placeholder="" optional />
        </>)}

        {kind === "incident" && (<>
          <FormGrid>
            <Select name="incidentType" label={t("common.type")} options={["near_miss", "injury", "property_damage", "environmental", "fire", "vehicle", "other"].map((x) => ({ value: x, label: label("incidents.type", x) }))} />
            <Select name="severity" label={t("common.priority")} options={["low", "medium", "high", "critical"].map((x) => ({ value: x, label: label("incidents.severity", x) }))} defaultValue="medium" />
          </FormGrid>
          <Input name="title" label={t("incidents.titleLabel")} required maxLength={200} />
          <Textarea name="description" label={t("common.description")} required />
          <Textarea name="immediateAction" label={t("incidents.immediateAction")} optional />
          <FormGrid>
            <Input name="occurredAt" type="datetime-local" label={t("incidents.occurredAt")} defaultValue={localNowInput()} />
            <Select name="projectId" label={t("common.project")} options={p.projects} defaultValue={p.defaults.projectId ?? ""} placeholder="" optional />
          </FormGrid>
          <Select name="machineId" label={t("common.machine")} options={p.machines} placeholder="" optional />
        </>)}

        {kind === "production" && (<>
          <FormGrid>
            <Select name="projectId" label={t("common.project")} options={p.projects} defaultValue={p.defaults.projectId ?? ""} placeholder="" required />
            <Select name="machineId" label={t("common.machine")} options={p.machines} defaultValue={p.defaults.machineId ?? ""} placeholder="" optional />
          </FormGrid>
          <FormGrid cols={3}>
            <Input name="quantity" type="number" inputMode="decimal" step="0.01" min={0.01} label={t("production.quantity")} required />
            <Select name="unit" label={t("production.unit")} options={["m3", "units", "loads", "other"].map((u) => ({ value: u, label: label("production.units", u) }))} />
            <Input name="date" type="date" label={t("common.date")} defaultValue={new Date().toISOString().slice(0, 10)} />
          </FormGrid>
          <Input name="unitLabel" label={t("production.unitLabel")} optional />
          <Textarea name="notes" label={t("common.notes")} optional />
        </>)}

        {kind === "photo" && (
          <Select name="target" label={t("report.photoTarget")} required placeholder=""
            options={[
              ...p.projects.map((o) => ({ value: `project:${o.value}`, label: o.label, group: t("projects.title") })),
              ...p.machines.map((o) => ({ value: `machine:${o.value}`, label: o.label, group: t("machines.title") })),
            ]}
            defaultValue={p.defaults.projectId ? `project:${p.defaults.projectId}` : ""} />
        )}

        {kind !== "production" && (
          <div>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" multiple className="sr-only"
              onChange={(e) => { setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 8)); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInput.current?.click()}
              className="flex h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-ink-2 hover:border-forest-400 hover:bg-forest-800/30">
              <Camera className="h-5 w-5 text-moss" /> {photoLabel}
            </button>
            {photos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {photos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
                    <Thumb file={f} />
                    <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label={t("common.delete")}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(kind === "repair" || kind === "incident" || kind === "fuel") && (
          <Button type="button" variant="ghost" size="sm" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className={cn("h-4 w-4", pos ? "text-ok" : "text-muted")} />}
            {pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : t("report.addLocation")}
          </Button>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={() => choose(null)}>{t("common.cancel")}</Button>
        <Button type="submit" size="lg" disabled={busy} className="min-w-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t("common.send")}
        </Button>
      </div>
    </form>
  );
}

function Thumb({ file }: { file: File }): ReactNode {
  const [url] = useState(() => URL.createObjectURL(file));
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />;
}
