import type { Metadata } from "next";
import { AlertTriangle, Map as MapIcon, Mail, Radio, Satellite, ServerCog } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, NoPermission, PageHeader, SectionTitle } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requirePermission } from "@/lib/context";
import { publicEnv } from "@/lib/env";
import { hasServiceRole, serverEnv } from "@/lib/env.server";
import { fmtDateTime, fmtNumber, fmtRelative } from "@/lib/format";
import { MAPON_STALE_MS, effectiveMaponStatus, type MaponStatus } from "@/lib/integrations/mapon";
import { getOptions } from "@/lib/queries";
import { cn, type Tone } from "@/lib/utils";
import { LinkMachineSelect, MaponActions, MaponKeyForm } from "./components";

export const metadata: Metadata = { title: "Integrācijas" };

const STATUS_TONE: Record<MaponStatus, Tone> = { connected: "ok", delayed: "warn", error: "crit", not_configured: "off" };

function StatusPill({ status, label }: { status: MaponStatus; label: string }) {
  return <Badge tone={STATUS_TONE[status]} dot pulse={status === "connected"}>{label}</Badge>;
}

function ConfigRow({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
      ok ? "border-ok/25 bg-ok/8 text-ink-2" : "border-line bg-surface-2/40 text-muted")}>
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", ok ? "bg-ok" : "bg-off")} aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export default async function IntegrationsPage() {
  const ctx = await requirePermission("manage_integrations");
  const serviceKey = hasServiceRole();
  const envMaponKey = Boolean(serverEnv.maponApiKey);
  const canGps = ctx.can("view_gps");

  const [settingsRes, devicesRes, options] = await Promise.all([
    ctx.supabase.from("integration_settings")
      .select("provider, enabled, status, has_secret, secret_hint, last_sync_at, last_success_at, last_error, device_count, updated_at")
      .eq("organization_id", ctx.org.id),
    canGps
      ? ctx.supabase.from("mapon_devices")
        .select("id, unit_id, label, number, vehicle_title, vin, machine_id, last_update, latitude, longitude, engine_hours, mileage_km, state, connected")
        .eq("organization_id", ctx.org.id).order("label")
      : Promise.resolve({ data: [] }),
    getOptions(ctx),
  ]);
  const mapon = (settingsRes.data ?? []).find((s) => s.provider === "mapon") ?? null;
  const status = effectiveMaponStatus(mapon, envMaponKey);
  const devices = devicesRes.data ?? [];
  const hasKey = envMaponKey || Boolean(mapon?.has_secret);
  const machineName = new Map(options.machines.map((m) => [m.id, m.name]));
  const linkedCount = devices.filter((d) => d.machine_id).length;

  return (
    <>
      <PageHeader title={ctx.t("integrations.title")} subtitle={ctx.t("integrations.subtitle")} back={{ href: "/settings", label: ctx.t("nav.settings") }} />

      {!serviceKey && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn animate-fade-up">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.t("integrations.serviceRole.missing")}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------------ Mapon */}
        <Card className="topo-bg overflow-hidden animate-fade-up">
          <CardHeader icon={<Satellite className="h-4 w-4" />} title={ctx.t("integrations.mapon.title")} subtitle="GPS · CAN · telemetrija"
            action={<StatusPill status={status} label={ctx.label("integrations.status", status)} />} />
          <CardBody className="space-y-6">
            {status === "error" && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-crit/30 bg-crit/10 px-4 py-3 text-sm text-crit">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-medium">{ctx.t("map.maponUnavailable")}</span>
                  {mapon?.last_error && <span className="block text-crit/80">{ctx.label("integrations.mapon.errors", mapon.last_error, ctx.t("errors.generic"))}</span>}
                  {mapon?.last_success_at && <span className="block text-xs text-crit/70">{ctx.t("map.lastUpdate")}: {fmtDateTime(mapon.last_success_at, ctx.timezone)}</span>}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={ctx.t("integrations.mapon.connectionStatus")} value={ctx.label("integrations.status", status)} />
              <Stat label={ctx.t("integrations.mapon.lastSync")}
                value={mapon?.last_sync_at ? fmtRelative(mapon.last_sync_at) : ctx.t("integrations.mapon.never")}
                hint={mapon?.last_sync_at ? fmtDateTime(mapon.last_sync_at, ctx.timezone) : undefined} />
              <Stat label={ctx.t("integrations.mapon.lastSuccess")}
                value={mapon?.last_success_at ? fmtRelative(mapon.last_success_at) : ctx.t("integrations.mapon.never")}
                hint={mapon?.last_success_at ? fmtDateTime(mapon.last_success_at, ctx.timezone) : undefined} />
              <Stat label={ctx.t("integrations.mapon.devices")} value={mapon?.device_count != null ? fmtNumber(mapon.device_count) : "—"}
                hint={devices.length ? `${linkedCount} / ${devices.length} ${ctx.t("integrations.mapon.linkedMachine").toLowerCase()}` : undefined} />
            </div>

            <div className="space-y-3 border-t border-line pt-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted">{ctx.t("integrations.mapon.apiKey")}:</span>
                {envMaponKey ? <Badge tone="forest">{ctx.t("integrations.mapon.apiKeyEnv")}</Badge> : null}
                {mapon?.has_secret && mapon.secret_hint ? <Badge tone="neutral">{ctx.t("integrations.mapon.apiKeySet", { hint: mapon.secret_hint })}</Badge> : null}
                {!hasKey && <Badge tone="off">{ctx.t("integrations.mapon.noKey")}</Badge>}
              </div>
              {envMaponKey && mapon?.has_secret && <p className="text-xs text-faint">{ctx.t("integrations.mapon.envOverrides")}</p>}
              {serviceKey && <MaponKeyForm hasStoredKey={Boolean(mapon?.has_secret)} />}
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <MaponActions disabled={!serviceKey || !hasKey} />
              <p className="max-w-md text-xs text-faint">{ctx.t("integrations.mapon.cronHint")}</p>
            </div>
          </CardBody>
        </Card>

        {/* ------------------------------------------------------------ side cards */}
        <div className="space-y-5">
          <Card className="animate-fade-up" >
            <CardHeader icon={<MapIcon className="h-4 w-4" />} title={ctx.t("integrations.mapbox.title")}
              action={<Badge tone={publicEnv.mapboxToken ? "ok" : "info"} dot>{publicEnv.mapboxToken ? ctx.t("integrations.enabled") : "OpenFreeMap"}</Badge>} />
            <CardBody className="space-y-3">
              <ConfigRow ok={Boolean(publicEnv.mapboxToken)}>
                {publicEnv.mapboxToken ? ctx.t("integrations.mapbox.configured") : ctx.t("integrations.mapbox.fallback")}
              </ConfigRow>
              <p className="text-xs text-faint">{ctx.t("integrations.mapbox.hint")}</p>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader icon={<Mail className="h-4 w-4" />} title={ctx.t("integrations.email.title")}
              action={<Badge tone={serverEnv.resendApiKey ? "ok" : "off"} dot>{serverEnv.resendApiKey ? ctx.t("integrations.enabled") : ctx.t("integrations.disabled")}</Badge>} />
            <CardBody className="space-y-3">
              <ConfigRow ok={Boolean(serverEnv.resendApiKey)}>
                {serverEnv.resendApiKey ? ctx.t("integrations.email.configured") : ctx.t("integrations.email.notConfigured")}
                {serverEnv.resendApiKey && <span className="mt-0.5 block text-xs text-faint">{ctx.t("integrations.email.sender")}: {serverEnv.emailFrom}</span>}
              </ConfigRow>
              <p className="text-xs text-faint">{ctx.t("integrations.email.hint")}</p>
            </CardBody>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader icon={<ServerCog className="h-4 w-4" />} title={ctx.t("integrations.serviceRole.title")}
              action={<Badge tone={serviceKey ? "ok" : "crit"} dot>{serviceKey ? ctx.t("integrations.enabled") : ctx.t("integrations.disabled")}</Badge>} />
            <CardBody>
              <ConfigRow ok={serviceKey}>{serviceKey ? ctx.t("integrations.serviceRole.configured") : ctx.t("integrations.serviceRole.missing")}</ConfigRow>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------------ Mapon units */}
      <section className="mt-8 animate-fade-up">
        <SectionTitle action={devices.length > 0 ? <span className="text-xs text-faint">{ctx.t("integrations.mapon.autoLinkHint")}</span> : undefined}>
          {ctx.t("integrations.mapon.unitsTitle")}
        </SectionTitle>
        {!canGps ? (
          <NoPermission text={ctx.t("map.noGpsPermission")} />
        ) : (
          <DataTable rows={devices} rowKey={(d) => d.id}
            empty={<EmptyState icon={<Radio className="h-6 w-6" />} title={ctx.t("integrations.mapon.noUnits")} />}
            columns={[
              { key: "unit", header: ctx.t("integrations.mapon.unit"), cell: (d) => (
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{d.label ?? d.vehicle_title ?? `#${d.unit_id}`}</span>
                  <span className="block truncate text-xs text-muted">{[d.number, d.vin].filter(Boolean).join(" · ") || `ID ${d.unit_id}`}</span>
                </span>
              ) },
              { key: "data", header: ctx.t("integrations.mapon.lastData"), cell: (d) => {
                const stale = !d.last_update || Date.now() - new Date(d.last_update).getTime() > MAPON_STALE_MS;
                return d.last_update ? (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={stale ? "off" : "ok"} dot pulse={!stale}>{stale ? ctx.t("integrations.mapon.stale") : ctx.t("common.live")}</Badge>
                    <span className="text-xs text-ink-2" title={fmtDateTime(d.last_update, ctx.timezone)}>{fmtRelative(d.last_update)}</span>
                  </span>
                ) : <span className="text-faint">{ctx.t("common.noData")}</span>;
              } },
              { key: "pos", header: ctx.t("integrations.mapon.position"), hideOnMobile: true, cell: (d) => d.latitude != null && d.longitude != null
                ? <span className="font-mono text-xs text-ink-2">{Number(d.latitude).toFixed(5)}, {Number(d.longitude).toFixed(5)}</span>
                : <span className="text-faint">{ctx.t("map.noPosition")}</span> },
              { key: "eh", header: ctx.t("integrations.mapon.engineHours"), align: "right", hideOnMobile: true, cell: (d) => d.engine_hours != null ? `${fmtNumber(d.engine_hours, 1)} h` : "—" },
              { key: "km", header: ctx.t("integrations.mapon.mileage"), align: "right", hideOnMobile: true, cell: (d) => d.mileage_km != null ? `${fmtNumber(d.mileage_km)} km` : "—" },
              { key: "machine", header: ctx.t("integrations.mapon.linkedMachine"), cell: (d) => (
                <span className="inline-flex flex-col items-end gap-1 md:items-start">
                  <LinkMachineSelect deviceId={d.id} machineId={d.machine_id} machines={options.machineOptions} />
                  {d.machine_id && !machineName.has(d.machine_id) && <span className="text-[11px] text-faint">{ctx.t("errors.notFound")}</span>}
                </span>
              ) },
            ]} />
        )}
      </section>
    </>
  );
}
