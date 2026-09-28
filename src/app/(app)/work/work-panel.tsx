"use client";

import { AlertTriangle, CloudOff, Coffee, Loader2, MapPin, Play, RefreshCw, Square, Trash2, Tractor, TreePine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { fmtDuration, fmtHours, fmtTime } from "@/lib/format";
import { discard, enqueue, flush, getPosition, newId, type QueueEvent } from "@/lib/offline/queue";
import { useSyncQueue } from "@/lib/offline/use-sync";
import { cn } from "@/lib/utils";

export type ActiveShift = {
  id: string; startedAt: string; projectId: string | null; machineId: string | null; workType: string | null;
  openBreakId: string | null; breakStartedAt: string | null; closedBreakMs: number;
};

/** Server state + not-yet-synced queue events = what the worker actually did. */
function deriveShift(server: ActiveShift | null, events: QueueEvent[], orgId: string): ActiveShift | null {
  let s = server ? { ...server } : null;
  for (const ev of events) {
    if (ev.orgId !== orgId || ev.status !== "pending") continue;
    const p = ev.payload as Record<string, string | null>;
    if (ev.type === "check_in") {
      if (s?.id === p.workLogId) continue;
      s = { id: p.workLogId!, startedAt: p.startedAt!, projectId: p.projectId ?? null, machineId: p.machineId ?? null, workType: p.workType ?? null, openBreakId: null, breakStartedAt: null, closedBreakMs: 0 };
    } else if (ev.type === "break_start" && s && s.id === p.workLogId && !s.openBreakId) {
      s = { ...s, openBreakId: p.breakId!, breakStartedAt: p.startedAt! };
    } else if (ev.type === "break_end" && s && s.openBreakId === p.breakId) {
      s = { ...s, closedBreakMs: s.closedBreakMs + (new Date(p.endedAt!).getTime() - new Date(s.breakStartedAt!).getTime()), openBreakId: null, breakStartedAt: null };
    } else if (ev.type === "check_out" && s && s.id === p.workLogId) {
      s = null;
    }
  }
  return s;
}

export function WorkPanel({ orgId, userId, tz, active, projects, machines, workTypes, defaultProjectId, doneTodayHours }: {
  orgId: string; userId: string; tz: string; active: ActiveShift | null; projects: Option[]; machines: Option[]; workTypes: Option[];
  defaultProjectId: string | null; doneTodayHours: number;
}) {
  const { t, label } = useT();
  const { events, online, syncing, sync } = useSyncQueue(userId);
  const shift = useMemo(() => deriveShift(active, events, orgId), [active, events, orgId]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<null | "start" | "stop" | "break" | "locating">(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [machineId, setMachineId] = useState("");
  const [workType, setWorkType] = useState(workTypes[0]?.value ?? "");
  const [gps, setGps] = useState<"unknown" | "ok" | "off">("unknown");

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (!confirmStop) return;
    const tm = setTimeout(() => setConfirmStop(false), 5000);
    return () => clearTimeout(tm);
  }, [confirmStop]);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then((r) => setGps(r.state === "denied" ? "off" : r.state === "granted" ? "ok" : "unknown")).catch(() => {});
  }, []);

  async function push(type: QueueEvent["type"], payload: Record<string, unknown>, okMsg: string) {
    await enqueue({ id: newId(), type, userId, orgId, payload });
    if (navigator.onLine) {
      const r = await flush(userId);
      if (r.failed > 0) toast(t("work.failed"), "error");
      else toast(okMsg, "ok");
      sync();
    } else {
      toast(t("work.savedOffline"), "info");
    }
  }

  async function start() {
    if (!projectId && projects.length > 0) { toast(t("work.projectRequired"), "error"); return; }
    setBusy("locating");
    const pos = await getPosition(6000);
    setGps(pos ? "ok" : "off");
    setBusy("start");
    try {
      await push("check_in", {
        workLogId: newId(), projectId: projectId || null, machineId: machineId || null, workType: workType || null,
        startedAt: new Date().toISOString(), lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos ? Math.round(pos.accuracy) : null,
        device: navigator.userAgent.slice(0, 300),
      }, t("work.startedToast"));
    } finally { setBusy(null); }
  }

  async function stop() {
    if (!shift) return;
    if (!confirmStop) { setConfirmStop(true); return; }
    setConfirmStop(false);
    setBusy("locating");
    const pos = await getPosition(5000);
    setBusy("stop");
    try {
      const endedAt = new Date().toISOString();
      if (shift.openBreakId) await enqueue({ id: newId(), type: "break_end", userId, orgId, payload: { breakId: shift.openBreakId, endedAt } });
      await push("check_out", { workLogId: shift.id, endedAt, lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos ? Math.round(pos.accuracy) : null }, t("work.stopped"));
    } finally { setBusy(null); }
  }

  async function toggleBreak() {
    if (!shift) return;
    setBusy("break");
    try {
      if (shift.openBreakId) await push("break_end", { breakId: shift.openBreakId, endedAt: new Date().toISOString() }, t("work.breakEnded"));
      else await push("break_start", { breakId: newId(), workLogId: shift.id, startedAt: new Date().toISOString() }, t("work.breakStarted"));
    } finally { setBusy(null); }
  }

  const queueForOrg = events.filter((e) => e.orgId === orgId);
  const failed = queueForOrg.filter((e) => e.status === "failed");
  const pending = queueForOrg.filter((e) => e.status === "pending");

  let elapsed = 0, breakMs = 0;
  if (shift) {
    breakMs = shift.closedBreakMs + (shift.breakStartedAt ? now - new Date(shift.breakStartedAt).getTime() : 0);
    elapsed = Math.max(0, now - new Date(shift.startedAt).getTime() - breakMs);
  }
  const projectLabel = projects.find((p) => p.value === shift?.projectId)?.label;
  const machineLabel = machines.find((m) => m.value === shift?.machineId)?.label;

  return (
    <section className="card topo-bg relative overflow-hidden p-5 md:p-7">
      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          <CloudOff className="h-4 w-4 shrink-0" /> {t("work.offline")}
        </div>
      )}

      {shift ? (
        <div className="flex flex-col items-center text-center">
          <Badge tone={shift.openBreakId ? "warn" : "ok"} dot pulse className="px-3 py-1 text-xs">
            {shift.openBreakId ? t("work.onBreak") : t("work.active")}
          </Badge>
          <div className="mt-4 font-display text-6xl font-bold tabular tracking-wide text-ink md:text-7xl" aria-live="off">{fmtDuration(elapsed)}</div>
          <div className="mt-2 text-sm text-muted">
            {t("work.since")} {fmtTime(shift.startedAt, tz)}
            {breakMs > 60_000 && <> · {t("work.breaksTotal")}: {fmtDuration(breakMs).slice(0, 5)}</>}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
            {projectLabel && <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-3 py-1.5"><TreePine className="h-4 w-4 text-moss" />{projectLabel}</span>}
            {machineLabel && <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-3 py-1.5"><Tractor className="h-4 w-4 text-amber" />{machineLabel}</span>}
            {shift.workType && <span className="inline-flex items-center rounded-full border border-line bg-surface-2/70 px-3 py-1.5">{workTypes.find((w) => w.value === shift.workType)?.label ?? shift.workType}</span>}
          </div>
          <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3">
            <Button size="lg" variant="secondary" className="h-16 text-base" onClick={toggleBreak} disabled={busy !== null}>
              {busy === "break" ? <Loader2 className="h-5 w-5 animate-spin" /> : shift.openBreakId ? <Play className="h-5 w-5" /> : <Coffee className="h-5 w-5" />}
              {shift.openBreakId ? t("work.resume") : t("work.pause")}
            </Button>
            <Button size="lg" variant={confirmStop ? "danger" : "primary"} className="h-16 text-base" onClick={stop} disabled={busy !== null && busy !== "locating"}>
              {busy === "stop" || busy === "locating" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
              {confirmStop ? t("common.confirm") : t("work.stop")}
            </Button>
          </div>
          {confirmStop && <p className="mt-3 text-sm text-warn">{t("work.confirmStop")}</p>}
        </div>
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t("work.selectProject")} value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects} placeholder="" className="sm:col-span-2" />
            <Select label={t("work.optionalMachine")} value={machineId} onChange={(e) => setMachineId(e.target.value)} options={[{ value: "", label: t("work.noMachine") }, ...machines]} />
            {workTypes.length > 0 && <Select label={t("work.workType")} value={workType} onChange={(e) => setWorkType(e.target.value)} options={workTypes} />}
          </div>
          <button type="button" onClick={start} disabled={busy !== null}
            className="group relative mx-auto mt-8 grid h-44 w-44 place-items-center rounded-full bg-gradient-to-br from-forest-400 to-forest-700 text-ink shadow-[0_0_0_10px_rgba(94,160,110,0.12),0_20px_60px_-10px_rgba(94,160,110,0.55)] transition hover:scale-[1.03] active:scale-95 disabled:opacity-70">
            <span className="absolute inset-0 animate-ping rounded-full bg-forest-400/20 [animation-duration:2.4s]" aria-hidden />
            <span className="relative flex flex-col items-center gap-1.5">
              {busy ? <Loader2 className="h-10 w-10 animate-spin" /> : <Play className="h-10 w-10 translate-x-0.5" />}
              <span className="font-display text-xl font-bold uppercase tracking-wider">{busy === "locating" ? t("work.locating") : t("work.start")}</span>
            </span>
          </button>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
            <MapPin className={cn("h-3.5 w-3.5", gps === "off" ? "text-warn" : "text-moss")} />
            {gps === "off" ? t("work.gpsOff") : gps === "ok" ? t("work.gpsOn") : t("work.gpsAsk")}
          </p>
          <p className="mt-2 text-center text-sm text-ink-2">{t("work.doneToday")}: <span className="tabular font-semibold">{fmtHours(doneTodayHours)}</span></p>
        </div>
      )}

      {(pending.length > 0 || failed.length > 0) && (
        <div className="mt-8 rounded-xl border border-line bg-bg-2/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted">
            <span>{t("work.queueTitle")}</span>
            <Button size="sm" variant="ghost" onClick={() => sync()} disabled={syncing || !online}>
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> {syncing ? t("work.syncing") : t("work.retry")}
            </Button>
          </div>
          <ul className="space-y-1.5 text-sm">
            {[...failed, ...pending].map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                {e.status === "failed" ? <AlertTriangle className="h-4 w-4 shrink-0 text-crit" /> : <CloudOff className="h-4 w-4 shrink-0 text-warn" />}
                <span className="flex-1 truncate">{label("work.events", e.type)} · <span className="text-muted">{fmtTime(e.createdAt, tz)}</span>
                  {e.lastError && <span className="block truncate text-xs text-crit">{e.lastError}</span>}
                </span>
                {e.status === "failed" && (
                  <Button size="sm" variant="ghost" onClick={() => discard(e.id)} aria-label={t("work.discard")}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
