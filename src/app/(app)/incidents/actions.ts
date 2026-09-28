"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { localInputToUtc } from "@/lib/format";

const TYPES = ["injury", "near_miss", "property_damage", "environmental", "fire", "vehicle", "other"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["open", "investigating", "action_required", "resolved", "closed"] as const;

const reportSchema = z.object({
  id: zf.uuid(),
  title: zf.reqText(200),
  incident_type: z.enum(TYPES),
  severity: z.enum(SEVERITIES),
  occurred_at: zf.dateTimeLocal(),
  project_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  employee_id: zf.optUuid(),
  location_text: zf.text(300).optional(),
  latitude: zf.optNum(-90, 90),
  longitude: zf.optNum(-180, 180),
  description: zf.reqText(5000),
  immediate_action: zf.text(5000).optional(),
});

/** Any member can report. The client pre-generates the id so photos can be attached before saving (also idempotent). */
export async function reportIncident(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if ((d.latitude == null) !== (d.longitude == null)) return fail(ctx.t("errors.validation"), { latitude: ctx.t("errors.validation") });

  let occurredAt: string;
  try {
    occurredAt = localInputToUtc(d.occurred_at, ctx.timezone);
  } catch {
    return fail(ctx.t("errors.invalidDate"), { occurred_at: ctx.t("errors.invalidDate") });
  }
  if (Number.isNaN(Date.parse(occurredAt)) || Date.parse(occurredAt) > Date.now() + 5 * 60_000) {
    return fail(ctx.t("errors.invalidDate"), { occurred_at: ctx.t("errors.invalidDate") });
  }

  const { error } = await ctx.supabase.from("incidents").insert({
    id: d.id, organization_id: ctx.org.id, idempotency_key: d.id, reported_by: ctx.user.id,
    title: d.title, incident_type: d.incident_type, severity: d.severity, occurred_at: occurredAt,
    project_id: d.project_id ?? null, machine_id: d.machine_id ?? null, employee_id: d.employee_id ?? null,
    location_text: d.location_text ?? null, latitude: d.latitude ?? null, longitude: d.longitude ?? null,
    description: d.description, immediate_action: d.immediate_action ?? null,
  });
  // 23505 = the same submission already arrived (double tap / retry) — treat as success.
  if (error && error.code !== "23505") return dbFail("incident.report", error);
  revalidatePath("/incidents");
  redirect(`/incidents/${d.id}`);
}

export async function setIncidentStatus(id: string, status: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_incidents", "manage_safety")) return fail(ctx.t("errors.permission"));
  const s = z.enum(STATUSES).safeParse(status);
  if (!s.success || !z.string().uuid().safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("incidents").update({ status: s.data }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("incident.status", error);
  revalidatePath(`/incidents/${id}`);
  revalidatePath("/incidents");
  return { ok: true };
}

const responseSchema = z.object({
  severity: z.enum(SEVERITIES),
  incident_type: z.enum(TYPES),
  manager_response: zf.text(5000).optional(),
  investigation: zf.text(5000).optional(),
  corrective_action: zf.text(5000).optional(),
});

export async function updateIncidentResponse(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("manage_incidents", "manage_safety")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(responseSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const { error } = await ctx.supabase.from("incidents").update({
    severity: d.severity, incident_type: d.incident_type,
    manager_response: d.manager_response ?? null, investigation: d.investigation ?? null, corrective_action: d.corrective_action ?? null,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("incident.response", error);
  revalidatePath(`/incidents/${id}`);
  return { ok: true };
}
