import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createT, getDictionary } from "@/i18n";
import { dbErrorKey, logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Offline queue endpoint (spec: offline-first field work).
 *
 * Every event carries a client-generated UUID that is used as the row id and/or
 * idempotency key, so a retried event never creates a duplicate: a unique
 * violation on that key is answered with success.
 *
 * Responses:  200 {ok:true} → remove from queue
 *             4xx {ok:false,error} → permanent (kept as "failed" for the user)
 *             5xx / {retry:true} → transient, retried later in order
 * All writes run AS THE USER (RLS + DB triggers enforce permissions/validation).
 */
export const dynamic = "force-dynamic";

const { t } = createT(getDictionary("lv"));
const MAX_FILE = 50 * 1024 * 1024;

const uuid = z.string().uuid();
const optUuid = uuid.nullish();
const iso = z.string().datetime({ offset: true });
const lat = z.number().min(-90).max(90).nullish();
const lng = z.number().min(-180).max(180).nullish();
const currency = z.enum(["EUR", "SEK", "ISK"]);

const envelope = z.object({
  id: uuid,
  type: z.enum(["check_in", "check_out", "break_start", "break_end", "fuel", "expense", "repair", "incident", "task_status", "production", "photo"]),
  orgId: uuid,
  payload: z.record(z.string(), z.unknown()),
  createdAt: iso,
});

const schemas = {
  check_in: z.object({ workLogId: uuid, projectId: optUuid, machineId: optUuid, workType: z.string().max(80).nullish(), startedAt: iso, lat, lng, accuracy: z.number().min(0).max(100000).nullish(), device: z.string().max(300).nullish() }),
  check_out: z.object({ workLogId: uuid, endedAt: iso, lat, lng, accuracy: z.number().min(0).max(100000).nullish(), notes: z.string().max(2000).nullish() }),
  break_start: z.object({ breakId: uuid, workLogId: uuid, startedAt: iso }),
  break_end: z.object({ breakId: uuid, endedAt: iso }),
  fuel: z.object({ machineId: uuid, projectId: optUuid, occurredAt: iso, litres: z.number().positive().max(5000), totalAmount: z.number().min(0).max(1e7).nullish(), currency, fuelType: z.string().max(40).default("diesel"), engineHours: z.number().min(0).max(1e7).nullish(), mileage: z.number().min(0).max(1e8).nullish(), location: z.string().max(200).nullish(), lat, lng, notes: z.string().max(2000).nullish() }),
  expense: z.object({ expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.number().positive().max(1e7), currency, category: z.string().min(1).max(40), projectId: optUuid, machineId: optUuid, description: z.string().max(2000).nullish(), submit: z.boolean().default(true) }),
  repair: z.object({ machineId: uuid, projectId: optUuid, category: z.string().max(60).default("other"), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"), title: z.string().min(1).max(200), description: z.string().max(4000).nullish(), lat, lng, location: z.string().max(200).nullish() }),
  incident: z.object({ occurredAt: iso, severity: z.enum(["low", "medium", "high", "critical"]).default("medium"), incidentType: z.enum(["injury", "near_miss", "property_damage", "environmental", "fire", "vehicle", "other"]).default("other"), title: z.string().min(1).max(200), description: z.string().min(1).max(4000), immediateAction: z.string().max(2000).nullish(), projectId: optUuid, machineId: optUuid, lat, lng, location: z.string().max(200).nullish() }),
  task_status: z.object({ taskId: uuid, status: z.enum(["todo", "in_progress", "waiting", "done", "cancelled"]) }),
  production: z.object({ projectId: uuid, machineId: optUuid, workSiteId: optUuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().positive().max(1e7), unit: z.enum(["m3", "units", "loads", "other"]), unitLabel: z.string().max(40).nullish(), notes: z.string().max(2000).nullish() }),
  photo: z.object({ entityType: z.enum(["project", "machine", "repair", "incident", "task", "expense", "fuel", "production"]), entityId: uuid, kind: z.enum(["photo", "before", "after", "receipt"]).default("photo") }),
} as const;

type Sb = Awaited<ReturnType<typeof createClient>>;
type DbErr = { code?: string; message?: string; details?: string | null } | null;
type Ctx = { sb: Sb; userId: string; orgId: string; employeeId: string | null; offline: boolean; eventId: string };

function ok() { return NextResponse.json({ ok: true }); }
function permanent(error: string, status = 422) { return NextResponse.json({ ok: false, error }, { status }); }
function transient(error = t("errors.generic")) { return NextResponse.json({ ok: false, error, retry: true }, { status: 503 }); }

function dbResult(scope: string, err: DbErr) {
  if (!err) return ok();
  if (err.code === "23505" && /idempotency|_pkey/.test(`${err.message} ${err.details ?? ""}`)) return ok(); // already applied
  logServerError(`sync.${scope}`, err);
  const key = dbErrorKey(err);
  if (key === "errors.offline" || key === "errors.generic") return transient(t(key));
  if (key === "errors.sessionExpired") return permanent(t(key), 401);
  return permanent(t(key));
}

async function uploadFiles(c: Ctx, files: File[], entityType: string, entityId: string, kind: string, bucket: "media" | "receipts" = "media") {
  const ids: string[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE) continue;
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
    // deterministic path per event+index → retried uploads don't duplicate
    const path = `${c.orgId}/${entityType}/${entityId}/${c.eventId}-${ids.length}.${ext}`;
    const { error: upErr } = await c.sb.storage.from(bucket).upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (upErr && !/exists|duplicate/i.test(upErr.message)) { logServerError("sync.upload", upErr); throw new Error("upload"); }
    const { data, error } = await c.sb.from("files").insert({
      organization_id: c.orgId, bucket, path, entity_type: entityType, entity_id: entityId, kind,
      original_name: f.name.slice(0, 255), mime_type: f.type || null, size_bytes: f.size, uploaded_by: c.userId,
    }).select("id").single();
    if (error && error.code !== "23505") { logServerError("sync.file", error); throw new Error("file"); }
    if (data) ids.push(data.id);
    else {
      const { data: existing } = await c.sb.from("files").select("id").eq("bucket", bucket).eq("path", path).maybeSingle();
      if (existing) ids.push(existing.id);
    }
  }
  return ids;
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: t("errors.sessionExpired") }, { status: 401 });
  if (!rateLimit(`sync:${user.id}`, 240, 60_000).ok) return transient(t("errors.rateLimited"));

  let form: FormData;
  try { form = await req.formData(); } catch { return permanent(t("errors.validation"), 400); }
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("event") ?? "")); } catch { return permanent(t("errors.validation"), 400); }
  const env = envelope.safeParse(raw);
  if (!env.success) return permanent(t("errors.validation"), 400);
  const ev = env.data;

  const { data: member } = await sb.from("organization_members").select("organization_id").eq("organization_id", ev.orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return permanent(t("errors.permission"), 403);
  const { data: emp } = await sb.from("employees").select("id, country_id").eq("organization_id", ev.orgId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();

  const files = [...form.entries()].filter(([k, v]) => k.startsWith("file:") && v instanceof File).map(([k, v]) => ({ field: k.slice(5), file: v as File }));
  const c: Ctx = { sb, userId: user.id, orgId: ev.orgId, employeeId: emp?.id ?? null, eventId: ev.id, offline: Date.now() - new Date(ev.createdAt).getTime() > 120_000 };

  const schema = schemas[ev.type];
  const parsed = schema.safeParse(ev.payload);
  if (!parsed.success) return permanent(t("errors.validation"));

  try {
    switch (ev.type) {
      case "check_in": {
        const p = parsed.data as z.infer<typeof schemas.check_in>;
        if (!c.employeeId) return permanent(t("work.noEmployee"));
        const { error } = await sb.from("work_logs").insert({
          id: p.workLogId, organization_id: c.orgId, employee_id: c.employeeId, project_id: p.projectId ?? null, machine_id: p.machineId ?? null,
          work_type: p.workType ?? null, started_at: p.startedAt, start_lat: p.lat ?? null, start_lng: p.lng ?? null, start_accuracy_m: p.accuracy ?? null,
          device_info: p.device ? { ua: p.device } : null, source: c.offline ? "offline" : "app", idempotency_key: ev.id, created_by: c.userId,
        });
        if (error?.code === "23505") {
          const { data: same } = await sb.from("work_logs").select("id").eq("id", p.workLogId).maybeSingle();
          if (same) return ok();
        }
        return dbResult("check_in", error);
      }
      case "check_out": {
        const p = parsed.data as z.infer<typeof schemas.check_out>;
        const { data: log } = await sb.from("work_logs").select("id, started_at, ended_at").eq("id", p.workLogId).maybeSingle();
        if (!log) return permanent(t("errors.notFound"), 404);
        if (log.ended_at) return ok(); // already closed (retry)
        const endedAt = new Date(p.endedAt) <= new Date(log.started_at) ? new Date(new Date(log.started_at).getTime() + 60_000).toISOString() : p.endedAt;
        await sb.from("work_breaks").update({ ended_at: endedAt }).eq("work_log_id", log.id).is("ended_at", null);
        const { error } = await sb.from("work_logs").update({
          ended_at: endedAt, status: "completed", end_lat: p.lat ?? null, end_lng: p.lng ?? null, end_accuracy_m: p.accuracy ?? null,
          ...(p.notes ? { notes: p.notes } : {}),
        }).eq("id", log.id);
        return dbResult("check_out", error);
      }
      case "break_start": {
        const p = parsed.data as z.infer<typeof schemas.break_start>;
        const { error } = await sb.from("work_breaks").insert({ id: p.breakId, organization_id: c.orgId, work_log_id: p.workLogId, started_at: p.startedAt, idempotency_key: ev.id });
        if (error?.code === "23505" && /one_open/.test(error.message)) return ok(); // a break is already open
        return dbResult("break_start", error);
      }
      case "break_end": {
        const p = parsed.data as z.infer<typeof schemas.break_end>;
        const { data: br } = await sb.from("work_breaks").select("id, started_at, ended_at").eq("id", p.breakId).maybeSingle();
        if (!br) return permanent(t("errors.notFound"), 404);
        if (br.ended_at) return ok();
        const endedAt = new Date(p.endedAt) <= new Date(br.started_at) ? new Date(new Date(br.started_at).getTime() + 1000).toISOString() : p.endedAt;
        const { error } = await sb.from("work_breaks").update({ ended_at: endedAt }).eq("id", br.id);
        return dbResult("break_end", error);
      }
      case "fuel": {
        const p = parsed.data as z.infer<typeof schemas.fuel>;
        const { data: existing } = await sb.from("fuel_logs").select("id").eq("organization_id", c.orgId).eq("idempotency_key", ev.id).maybeSingle();
        if (existing) return ok();
        let receiptId: string | null = null;
        const receiptFiles = files.filter((f) => f.field === "receipt").map((f) => f.file);
        if (receiptFiles.length) {
          const { data: r, error: rErr } = await sb.from("receipts").insert({
            id: ev.id, organization_id: c.orgId, receipt_date: p.occurredAt.slice(0, 10), amount: p.totalAmount ?? null, currency: p.currency,
            uploaded_by: c.userId, employee_id: c.employeeId, ocr_confirmed: p.totalAmount != null,
          }).select("id").single();
          if (rErr && rErr.code !== "23505") return dbResult("fuel.receipt", rErr);
          receiptId = r?.id ?? ev.id;
          const [fileId] = await uploadFiles(c, receiptFiles, "receipt", receiptId, "receipt", "receipts");
          if (fileId) await sb.from("receipts").update({ file_id: fileId }).eq("id", receiptId);
        }
        const { error } = await sb.from("fuel_logs").insert({
          organization_id: c.orgId, occurred_at: p.occurredAt, employee_id: c.employeeId, machine_id: p.machineId, project_id: p.projectId ?? null,
          fuel_type: p.fuelType, litres: p.litres, total_amount: p.totalAmount ?? null, price_per_litre: p.totalAmount != null ? Math.round((p.totalAmount / p.litres) * 10000) / 10000 : null,
          currency: p.currency, engine_hours: p.engineHours ?? null, mileage_km: p.mileage ?? null, location_text: p.location ?? null,
          latitude: p.lat ?? null, longitude: p.lng ?? null, notes: p.notes ?? null, receipt_id: receiptId,
          source: c.offline ? "offline" : "employee", idempotency_key: ev.id, created_by: c.userId,
        });
        return dbResult("fuel", error);
      }
      case "expense": {
        const p = parsed.data as z.infer<typeof schemas.expense>;
        const { data: existing } = await sb.from("expenses").select("id").eq("organization_id", c.orgId).eq("idempotency_key", ev.id).maybeSingle();
        if (existing) return ok();
        let receiptId: string | null = null;
        const receiptFiles = files.filter((f) => f.field === "receipt").map((f) => f.file);
        if (receiptFiles.length) {
          const { data: r, error: rErr } = await sb.from("receipts").insert({
            id: ev.id, organization_id: c.orgId, receipt_date: p.expenseDate, amount: p.amount, currency: p.currency, uploaded_by: c.userId, employee_id: c.employeeId, ocr_confirmed: true,
          }).select("id").single();
          if (rErr && rErr.code !== "23505") return dbResult("expense.receipt", rErr);
          receiptId = r?.id ?? ev.id;
          const [fileId] = await uploadFiles(c, receiptFiles, "receipt", receiptId, "receipt", "receipts");
          if (fileId) await sb.from("receipts").update({ file_id: fileId }).eq("id", receiptId);
        }
        const submit = p.submit && (receiptId || (p.description && p.description.length > 2));
        const { error } = await sb.from("expenses").insert({
          organization_id: c.orgId, expense_date: p.expenseDate, amount: p.amount, currency: p.currency, category: p.category,
          project_id: p.projectId ?? null, machine_id: p.machineId ?? null, employee_id: c.employeeId, description: p.description ?? null,
          receipt_id: receiptId, status: submit ? "submitted" : "draft", idempotency_key: ev.id, created_by: c.userId,
        });
        return dbResult("expense", error);
      }
      case "repair": {
        const p = parsed.data as z.infer<typeof schemas.repair>;
        const { data: existing } = await sb.from("repair_requests").select("id").eq("organization_id", c.orgId).eq("idempotency_key", ev.id).maybeSingle();
        let repairId = existing?.id ?? null;
        if (!repairId) {
          const { data, error } = await sb.from("repair_requests").insert({
            id: ev.id, organization_id: c.orgId, machine_id: p.machineId, project_id: p.projectId ?? null, reported_by_employee_id: c.employeeId,
            category: p.category, priority: p.priority, title: p.title, description: p.description ?? null, latitude: p.lat ?? null, longitude: p.lng ?? null,
            location_text: p.location ?? null, idempotency_key: ev.id, created_by: c.userId,
          }).select("id").single();
          if (error) return dbResult("repair", error);
          repairId = data.id;
        }
        await uploadFiles(c, files.map((f) => f.file), "repair", repairId, "before");
        return ok();
      }
      case "incident": {
        const p = parsed.data as z.infer<typeof schemas.incident>;
        const { data: existing } = await sb.from("incidents").select("id").eq("organization_id", c.orgId).eq("idempotency_key", ev.id).maybeSingle();
        let incidentId = existing?.id ?? null;
        if (!incidentId) {
          const { data, error } = await sb.from("incidents").insert({
            id: ev.id, organization_id: c.orgId, occurred_at: p.occurredAt, severity: p.severity, incident_type: p.incidentType, title: p.title,
            description: p.description, immediate_action: p.immediateAction ?? null, project_id: p.projectId ?? null, machine_id: p.machineId ?? null,
            employee_id: c.employeeId, latitude: p.lat ?? null, longitude: p.lng ?? null, location_text: p.location ?? null, reported_by: c.userId, idempotency_key: ev.id,
          }).select("id").single();
          if (error) return dbResult("incident", error);
          incidentId = data.id;
        }
        await uploadFiles(c, files.map((f) => f.file), "incident", incidentId, "photo");
        return ok();
      }
      case "task_status": {
        const p = parsed.data as z.infer<typeof schemas.task_status>;
        const { data, error } = await sb.from("tasks").update({ status: p.status, position: Date.now() }).eq("id", p.taskId).eq("organization_id", c.orgId).select("id").maybeSingle();
        if (error) return dbResult("task_status", error);
        return data ? ok() : permanent(t("errors.permission"), 403);
      }
      case "production": {
        const p = parsed.data as z.infer<typeof schemas.production>;
        const { error } = await sb.from("production_logs").insert({
          id: ev.id, organization_id: c.orgId, project_id: p.projectId, machine_id: p.machineId ?? null, work_site_id: p.workSiteId ?? null,
          production_date: p.date, quantity: p.quantity, unit: p.unit, unit_label: p.unitLabel ?? null, notes: p.notes ?? null,
          employee_id: c.employeeId, created_by: c.userId,
        });
        return dbResult("production", error);
      }
      case "photo": {
        const p = parsed.data as z.infer<typeof schemas.photo>;
        if (!files.length) return permanent(t("errors.validation"));
        await uploadFiles(c, files.map((f) => f.file), p.entityType, p.entityId, p.kind);
        return ok();
      }
    }
  } catch (e) {
    logServerError(`sync.${ev.type}`, e);
    return transient();
  }
  return permanent(t("errors.validation"));
}
