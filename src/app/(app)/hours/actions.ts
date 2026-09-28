"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { localInputToUtc } from "@/lib/format";

const logSchema = z.object({
  employee_id: zf.optUuid(),
  project_id: zf.optUuid(),
  machine_id: zf.optUuid(),
  work_type: zf.text(80).optional(),
  started_at: zf.dateTimeLocal(),
  ended_at: zf.dateTimeLocal(),
  notes: zf.text(2000).optional(),
});

function range(ctxTz: string, start: string, end: string) {
  const s = localInputToUtc(start, ctxTz);
  const e = localInputToUtc(end, ctxTz);
  return { s, e, valid: new Date(e) > new Date(s), tooLong: new Date(e).getTime() - new Date(s).getTime() > 24 * 3600_000 };
}

/** Correction of an existing log (edit_employee_hours or approve_hours in scope). DB marks it `corrected` and audits old→new. */
export async function correctWorkLog(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("edit_employee_hours", "approve_hours")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(logSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const r = range(ctx.timezone, d.started_at, d.ended_at);
  if (!r.valid) return fail(ctx.t("errors.endBeforeStart"), { ended_at: ctx.t("errors.endBeforeStart") });
  if (r.tooLong) return fail(ctx.t("hours.tooLong"), { ended_at: ctx.t("hours.tooLong") });
  const { error } = await ctx.supabase.from("work_logs").update({
    started_at: r.s, ended_at: r.e, project_id: d.project_id ?? null, machine_id: d.machine_id ?? null,
    work_type: d.work_type ?? null, notes: d.notes ?? null,
  }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("hours.correct", error);
  revalidatePath("/hours");
  return { ok: true, message: ctx.t("hours.corrected") };
}

/** Manual entry for a forgotten shift (edit_employee_hours). */
export async function addManualLog(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("edit_employee_hours")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(logSchema.extend({ employee_id: zf.uuid(), break_minutes: zf.optNum(0, 600) }), fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const r = range(ctx.timezone, d.started_at, d.ended_at);
  if (!r.valid) return fail(ctx.t("errors.endBeforeStart"), { ended_at: ctx.t("errors.endBeforeStart") });
  if (r.tooLong) return fail(ctx.t("hours.tooLong"), { ended_at: ctx.t("hours.tooLong") });
  const { data, error } = await ctx.supabase.from("work_logs").insert({
    organization_id: ctx.org.id, employee_id: d.employee_id, project_id: d.project_id ?? null, machine_id: d.machine_id ?? null,
    work_type: d.work_type ?? null, started_at: r.s, ended_at: r.e, status: "completed", source: "manual", notes: d.notes ?? null, created_by: ctx.user.id,
  }).select("id").single();
  if (error) return dbFail("hours.manual", error);
  const brk = d.break_minutes ?? 0;
  if (brk > 0) {
    const bStart = new Date(new Date(r.s).getTime() + (new Date(r.e).getTime() - new Date(r.s).getTime()) / 2);
    const bEnd = new Date(Math.min(bStart.getTime() + brk * 60_000, new Date(r.e).getTime() - 60_000));
    if (bEnd > bStart) await ctx.supabase.from("work_breaks").insert({ organization_id: ctx.org.id, work_log_id: data.id, started_at: bStart.toISOString(), ended_at: bEnd.toISOString() });
  }
  revalidatePath("/hours");
  return { ok: true };
}

export async function approveWorkLogs(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("approve_hours")) return fail(ctx.t("errors.permission"));
  const ids = String(fd.get("ids") ?? "").split(",").filter((x) => z.string().uuid().safeParse(x).success).slice(0, 500);
  if (!ids.length) return fail(ctx.t("errors.validation"));
  const { data, error } = await ctx.supabase.from("work_logs")
    .update({ status: "approved", approved_by: ctx.user.id, approved_at: new Date().toISOString() })
    .in("id", ids).eq("organization_id", ctx.org.id).not("ended_at", "is", null).in("status", ["completed", "corrected"]).select("id");
  if (error) return dbFail("hours.approve", error);
  revalidatePath("/hours");
  return { ok: true, message: ctx.t("hours.approvedN", { n: data?.length ?? 0 }) };
}

/** Closes a forgotten open shift (missing check-out) at a chosen time. */
export async function closeOpenShift(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.canAny("edit_employee_hours", "approve_hours")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(z.object({ ended_at: zf.dateTimeLocal() }), fd);
  if (!parsed.ok) return parsed.result;
  const end = localInputToUtc(parsed.data.ended_at, ctx.timezone);
  await ctx.supabase.from("work_breaks").update({ ended_at: end }).eq("work_log_id", id).is("ended_at", null);
  const { error } = await ctx.supabase.from("work_logs").update({ ended_at: end, status: "corrected" }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("hours.close", error);
  revalidatePath("/hours");
  return { ok: true };
}
