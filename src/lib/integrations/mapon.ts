import "server-only";
import type { Json } from "@/lib/database.types";
import { serverEnv } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mapon API integration layer (server-only).
 *
 * - The API key comes from the MAPON_API_KEY environment variable (takes
 *   precedence) or from `integration_secrets` (service role only, no RLS policy).
 *   It is NEVER returned to the browser and NEVER logged.
 * - All HTTP calls time out after 10 s (AbortController).
 * - Failure mode (spec §95): on any error the integration is marked `error`
 *   with a short error code; previously synced data is kept untouched, and
 *   the UI shows "Mapon dati pašlaik nav pieejami." with the last update time.
 * - Mapon devices do not all report every field: every value is optional.
 *
 * Endpoint used: GET {base}/unit/list.json?key=…&include[]=…
 * (base defaults to https://mapon.com/api/v1, override with MAPON_API_URL).
 */

export const MAPON_TIMEOUT_MS = 10_000;
/** Positions/devices older than this are never presented as live. */
export const MAPON_STALE_MS = 60 * 60 * 1000;
/** A successful sync older than this makes the integration "delayed". */
export const MAPON_DELAYED_MS = 2 * 60 * 60 * 1000;

export type MaponErrorCode = "no_key" | "unauthorized" | "timeout" | "unavailable" | "invalid_response";

export class MaponError extends Error {
  constructor(public readonly code: MaponErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MaponError";
  }
}

export type MaponUnit = {
  unitId: number;
  label: string | null;
  number: string | null;
  vehicleTitle: string | null;
  vin: string | null;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  heading: number | null;
  mileageKm: number | null;
  engineHours: number | null;
  /** "can" when engine hours came from the CAN bus, "gps" when derived from ignition time */
  engineHoursSource: "can" | "gps" | null;
  ignition: boolean | null;
  state: string | null;
  lastUpdate: string | null;
  raw: Record<string, unknown>;
};

export type MaponStatus = "connected" | "delayed" | "error" | "not_configured";

export type SyncSummary = { units: number; linked: number; autoLinked: number; positions: number; machinesUpdated: number };

/* ---------------------------------------------------------------- helpers */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  if (isRec(v) && "value" in v) return num(v.value);
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.includes("T") || s.endsWith("Z") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickCan(can: unknown, keys: string[]): number | null {
  if (!isRec(can)) return null;
  for (const k of keys) {
    const v = num(can[k]);
    if (v !== null) return v;
  }
  return null;
}

/** Removes the API key from any string before it can reach a log line. */
function redact(text: string, key: string) {
  return key ? text.split(key).join("***") : text;
}

/** Parses one Mapon unit defensively. Returns null when the unit has no usable id. */
export function parseUnit(u: unknown): MaponUnit | null {
  if (!isRec(u)) return null;
  const unitId = num(u.unit_id);
  if (unitId === null) return null;

  const lat = num(u.lat);
  const lng = num(u.lng);
  const validPos = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  // Mapon reports mileage in metres.
  const mileageM = num(u.mileage);
  const canOdoKm = pickCan(u.can, ["odom", "odometer", "total_distance", "mileage"]);
  const canHours = pickCan(u.can, ["engine_hours", "total_engine_hours", "engine_total_hours", "engine_work_time"]);
  // ignition_total_time: accumulated ignition-on time in seconds (fallback when CAN is not available).
  const ignitionSeconds = num(u.ignition_total_time);

  let ignition: boolean | null = null;
  if (isRec(u.ignition)) {
    const s = str(u.ignition.state) ?? str(u.ignition.value);
    if (s) ignition = ["on", "1", "true"].includes(s.toLowerCase());
  } else if (typeof u.ignition === "boolean") ignition = u.ignition;

  const movement = isRec(u.movement_state) ? str(u.movement_state.name) : null;
  const state = movement ?? (isRec(u.state) ? str(u.state.name) : str(u.state));

  return {
    unitId,
    label: str(u.label),
    number: str(u.number),
    vehicleTitle: str(u.vehicle_title),
    vin: str(u.vin),
    lat: validPos ? lat : null,
    lng: validPos ? lng : null,
    speedKmh: num(u.speed),
    heading: num(u.direction),
    mileageKm: canOdoKm ?? (mileageM !== null ? Math.round(mileageM / 100) / 10 : null),
    engineHours: canHours ?? (ignitionSeconds !== null ? Math.round(ignitionSeconds / 360) / 10 : null),
    engineHoursSource: canHours !== null ? "can" : ignitionSeconds !== null ? "gps" : null,
    ignition,
    state,
    lastUpdate: isoDate(u.last_update),
    raw: u,
  };
}

/* ---------------------------------------------------------------- key */

type Admin = ReturnType<typeof createAdminClient>;

export async function getMaponKey(admin: Admin, orgId: string): Promise<{ key: string; source: "env" | "stored" } | null> {
  if (serverEnv.maponApiKey) return { key: serverEnv.maponApiKey, source: "env" };
  const { data, error } = await admin.from("integration_secrets").select("secret").eq("organization_id", orgId).eq("provider", "mapon").maybeSingle();
  if (error) {
    logServerError("mapon.key", { code: error.code });
    return null;
  }
  return data?.secret ? { key: data.secret, source: "stored" } : null;
}

/* ---------------------------------------------------------------- HTTP */

async function maponGet(path: string, key: string, params: [string, string][] = []): Promise<unknown> {
  const url = new URL(`${serverEnv.maponBaseUrl}/${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of params) url.searchParams.append(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAPON_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new MaponError("timeout");
    throw new MaponError("unavailable", redact(e instanceof Error ? e.message : "fetch failed", key));
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new MaponError("unauthorized", `HTTP ${res.status}`);
  if (res.status >= 500 || res.status === 429) throw new MaponError("unavailable", `HTTP ${res.status}`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new MaponError(res.ok ? "invalid_response" : "unavailable", `HTTP ${res.status}`);
  }
  if (isRec(body) && body.error) {
    const err = isRec(body.error) ? body.error : {};
    const msg = redact(str(err.msg) ?? str(body.error) ?? "error", key);
    const code = num(err.code);
    // Mapon reports authentication problems with a message about the key.
    if (/key|auth|access|permission/i.test(msg) || code === 1 || code === 2) throw new MaponError("unauthorized", msg);
    throw new MaponError("invalid_response", msg);
  }
  if (!res.ok) throw new MaponError("unavailable", `HTTP ${res.status}`);
  return body;
}

/** Lists units. Optional includes are requested first; if Mapon rejects them we retry without. */
export async function fetchUnits(key: string, withTelemetry = true): Promise<MaponUnit[]> {
  const includes: [string, string][] = withTelemetry ? [["include[]", "ignition"], ["include[]", "can"]] : [];
  let body: unknown;
  try {
    body = await maponGet("unit/list.json", key, includes);
  } catch (e) {
    if (withTelemetry && e instanceof MaponError && e.code === "invalid_response") body = await maponGet("unit/list.json", key);
    else throw e;
  }
  const data = isRec(body) ? body.data : undefined;
  const units = isRec(data) ? data.units : Array.isArray(data) ? data : undefined;
  if (!Array.isArray(units)) throw new MaponError("invalid_response", "missing data.units");
  return units.map(parseUnit).filter((u): u is MaponUnit => u !== null);
}

/* ---------------------------------------------------------------- status */

export function effectiveMaponStatus(row: {
  status?: string | null; enabled?: boolean | null; has_secret?: boolean | null; last_success_at?: string | null;
} | null, envKey = Boolean(serverEnv.maponApiKey)): MaponStatus {
  const hasKey = envKey || Boolean(row?.has_secret);
  if (!row || !hasKey) return "not_configured";
  if (row.status === "error") return "error";
  if (!row.last_success_at) return row.status === "connected" ? "connected" : "not_configured";
  if (Date.now() - new Date(row.last_success_at).getTime() > MAPON_DELAYED_MS) return "delayed";
  return "connected";
}

async function markError(admin: Admin, orgId: string, code: MaponErrorCode) {
  const { error } = await admin.from("integration_settings").upsert({
    organization_id: orgId, provider: "mapon", status: code === "no_key" ? "not_configured" : "error",
    last_error: code, last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,provider" });
  if (error) logServerError("mapon.mark_error", { code: error.code, message: error.message });
}

function toMaponError(e: unknown): MaponError {
  if (e instanceof MaponError) return e;
  return new MaponError("unavailable", e instanceof Error ? e.message : "unknown");
}

export type MaponResult<T> = { ok: true; data: T } | { ok: false; code: MaponErrorCode };

/* ---------------------------------------------------------------- public API */

/** Checks credentials by listing units (no telemetry). Updates status only. */
export async function testConnection(orgId: string): Promise<MaponResult<{ units: number }>> {
  const admin = createAdminClient();
  const key = await getMaponKey(admin, orgId);
  if (!key) {
    await markError(admin, orgId, "no_key");
    return { ok: false, code: "no_key" };
  }
  try {
    const units = await fetchUnits(key.key, false);
    const { error } = await admin.from("integration_settings").upsert({
      organization_id: orgId, provider: "mapon", enabled: true, status: "connected", last_error: null,
      device_count: units.length, updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider" });
    if (error) logServerError("mapon.test.status", { code: error.code, message: error.message });
    return { ok: true, data: { units: units.length } };
  } catch (e) {
    const err = toMaponError(e);
    logServerError("mapon.test", { org: orgId, error: err.message });
    await markError(admin, orgId, err.code);
    return { ok: false, code: err.code };
  }
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();

/**
 * Pulls all units from Mapon and stores them:
 *  - mapon_devices (upsert, machine link preserved; unambiguous VIN / plate matches auto-linked)
 *  - gps_devices (provider mapon) for linked units
 *  - gps_positions for linked units with a NEW timestamp (source mapon_gps / mapon_can)
 *  - machines.engine_hours / mileage_km when telemetry increased (never decreased)
 * Never invents data: units without a position simply get no position row.
 */
export async function syncUnits(orgId: string): Promise<MaponResult<SyncSummary>> {
  const admin = createAdminClient();
  const key = await getMaponKey(admin, orgId);
  if (!key) {
    await markError(admin, orgId, "no_key");
    return { ok: false, code: "no_key" };
  }

  let units: MaponUnit[];
  try {
    units = await fetchUnits(key.key, true);
  } catch (e) {
    const err = toMaponError(e);
    logServerError("mapon.sync.fetch", { org: orgId, error: err.message });
    await markError(admin, orgId, err.code);
    return { ok: false, code: err.code };
  }

  try {
    const summary = await storeUnits(admin, orgId, units);
    const now = new Date().toISOString();
    const { error } = await admin.from("integration_settings").upsert({
      organization_id: orgId, provider: "mapon", enabled: true, status: "connected", last_error: null,
      last_sync_at: now, last_success_at: now, device_count: units.length, updated_at: now,
    }, { onConflict: "organization_id,provider" });
    if (error) logServerError("mapon.sync.status", { code: error.code, message: error.message });
    return { ok: true, data: summary };
  } catch (e) {
    logServerError("mapon.sync.store", { org: orgId, error: e instanceof Error ? e.message : String(e) });
    await markError(admin, orgId, "invalid_response");
    return { ok: false, code: "invalid_response" };
  }
}

async function storeUnits(admin: Admin, orgId: string, units: MaponUnit[]): Promise<SyncSummary> {
  const summary: SyncSummary = { units: units.length, linked: 0, autoLinked: 0, positions: 0, machinesUpdated: 0 };
  if (units.length === 0) return summary;

  const [existingRes, machinesRes] = await Promise.all([
    admin.from("mapon_devices").select("id, unit_id, machine_id, last_update").eq("organization_id", orgId),
    admin.from("machines").select("id, vin, registration_number, engine_hours, mileage_km")
      .eq("organization_id", orgId).is("deleted_at", null).is("archived_at", null),
  ]);
  if (existingRes.error) throw new Error(`mapon_devices read: ${existingRes.error.message}`);
  if (machinesRes.error) throw new Error(`machines read: ${machinesRes.error.message}`);
  const existing = new Map((existingRes.data ?? []).map((d) => [Number(d.unit_id), d]));
  const machines = machinesRes.data ?? [];
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const linkedMachineIds = new Set((existingRes.data ?? []).map((d) => d.machine_id).filter((x): x is string => Boolean(x)));

  const now = new Date().toISOString();
  const rows = units.map((u) => ({
    organization_id: orgId, unit_id: u.unitId, label: u.label, number: u.number, vehicle_title: u.vehicleTitle, vin: u.vin,
    last_update: u.lastUpdate, latitude: u.lat, longitude: u.lng, mileage_km: u.mileageKm, engine_hours: u.engineHours,
    state: u.state, connected: u.lastUpdate ? Date.now() - new Date(u.lastUpdate).getTime() < MAPON_STALE_MS : false,
    raw: u.raw as Json, synced_at: now,
  }));
  // machine_id is intentionally NOT in the payload → an existing manual link is preserved on conflict.
  const { data: upserted, error: upsertErr } = await admin.from("mapon_devices")
    .upsert(rows, { onConflict: "organization_id,unit_id" }).select("id, unit_id, machine_id");
  if (upsertErr) throw new Error(`mapon_devices upsert: ${upsertErr.message}`);
  const deviceByUnit = new Map((upserted ?? []).map((d) => [Number(d.unit_id), d]));

  // Auto-link unambiguous matches (VIN, then registration number) for unlinked devices.
  for (const u of units) {
    const dev = deviceByUnit.get(u.unitId);
    if (!dev || dev.machine_id) continue;
    const byVin = u.vin ? machines.filter((m) => m.vin && norm(m.vin) === norm(u.vin)) : [];
    const byPlate = !byVin.length && u.number ? machines.filter((m) => m.registration_number && norm(m.registration_number) === norm(u.number)) : [];
    const match = byVin.length === 1 ? byVin[0] : byPlate.length === 1 ? byPlate[0] : null;
    if (!match || linkedMachineIds.has(match.id)) continue;
    const { error } = await admin.from("mapon_devices").update({ machine_id: match.id }).eq("id", dev.id).is("machine_id", null);
    if (!error) {
      dev.machine_id = match.id;
      linkedMachineIds.add(match.id);
      summary.autoLinked++;
    }
  }

  for (const u of units) {
    const dev = deviceByUnit.get(u.unitId);
    const machineId = dev?.machine_id ?? null;
    if (!dev || !machineId) continue;
    summary.linked++;

    const online = u.lastUpdate ? Date.now() - new Date(u.lastUpdate).getTime() < MAPON_STALE_MS : false;
    const { data: gpsDev, error: gpsErr } = await admin.from("gps_devices").upsert({
      organization_id: orgId, provider: "mapon", external_id: String(u.unitId), machine_id: machineId,
      label: u.label ?? u.number, status: online ? "online" : "offline", last_seen_at: u.lastUpdate,
    }, { onConflict: "organization_id,provider,external_id" }).select("id").single();
    if (gpsErr) logServerError("mapon.gps_devices", { code: gpsErr.code, message: gpsErr.message });

    // New position only when Mapon reports a newer timestamp than we stored before.
    const prev = existing.get(u.unitId)?.last_update ?? null;
    const isNew = u.lastUpdate && (!prev || new Date(u.lastUpdate).getTime() > new Date(prev).getTime());
    if (isNew && u.lat !== null && u.lng !== null) {
      const { error } = await admin.from("gps_positions").insert({
        organization_id: orgId, device_id: gpsDev?.id ?? null, machine_id: machineId, recorded_at: u.lastUpdate!,
        latitude: u.lat, longitude: u.lng, speed_kmh: u.speedKmh, heading: u.heading, engine_hours: u.engineHours,
        mileage_km: u.mileageKm, ignition: u.ignition, source: u.engineHoursSource === "can" ? "mapon_can" : "mapon_gps",
      });
      if (!error) summary.positions++;
      else if (error.code !== "23505") logServerError("mapon.gps_positions", { code: error.code, message: error.message });
    }

    // Telemetry → machine (only increases; >= 1 h / 1 km steps keep the audit log readable).
    const m = machineById.get(machineId);
    if (m) {
      const patch: { engine_hours?: number; mileage_km?: number } = {};
      if (u.engineHours !== null && (m.engine_hours === null || u.engineHours - Number(m.engine_hours) >= 1)) patch.engine_hours = u.engineHours;
      if (u.mileageKm !== null && (m.mileage_km === null || u.mileageKm - Number(m.mileage_km) >= 1)) patch.mileage_km = u.mileageKm;
      if (Object.keys(patch).length) {
        const { error } = await admin.from("machines").update(patch).eq("id", machineId).eq("organization_id", orgId);
        if (!error) summary.machinesUpdated++;
        else logServerError("mapon.machine_telemetry", { code: error.code, message: error.message });
      }
    }
  }
  return summary;
}

/** Organizations whose Mapon integration is enabled (used by the cron route). */
export async function maponEnabledOrgs(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("integration_settings").select("organization_id").eq("provider", "mapon").eq("enabled", true);
  if (error) {
    logServerError("mapon.orgs", { code: error.code, message: error.message });
    return [];
  }
  return (data ?? []).map((r) => r.organization_id);
}
