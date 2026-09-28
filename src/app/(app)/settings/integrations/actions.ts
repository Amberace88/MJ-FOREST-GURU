"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { hasServiceRole, serverEnv } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { syncUnits, testConnection, type MaponErrorCode } from "@/lib/integrations/mapon";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/settings/integrations";

async function integrationsCtx() {
  const ctx = await requireOrg();
  if (!ctx.can("manage_integrations")) return { ctx, denied: fail(ctx.t("errors.permission")) } as const;
  if (!hasServiceRole()) return { ctx, denied: fail(ctx.t("integrations.serviceRole.missing")) } as const;
  return { ctx, denied: null } as const;
}

function maponFail(ctx: Awaited<ReturnType<typeof requireOrg>>, code: MaponErrorCode | "rate_limited") {
  return fail(ctx.label("integrations.mapon.errors", code, ctx.t("map.maponUnavailable")));
}

/* ------------------------------------------------------------ API key (stored server-side only) */
const keySchema = z.object({
  api_key: z.string({ error: "Obligāts lauks" }).min(8, "Pārāk īsa atslēga").max(200).regex(/^[A-Za-z0-9._\-]+$/, "Nederīgi simboli"),
});

export async function saveMaponKey(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { ctx, denied } = await integrationsCtx();
  if (denied) return denied;
  const parsed = parseForm(keySchema, fd);
  if (!parsed.ok) return parsed.result;
  const key = parsed.data.api_key;

  const admin = createAdminClient();
  const { error: secretErr } = await admin.from("integration_secrets").upsert(
    { organization_id: ctx.org.id, provider: "mapon", secret: key, updated_at: new Date().toISOString() },
    { onConflict: "organization_id,provider" },
  );
  if (secretErr) {
    logServerError("integrations.mapon_secret", { code: secretErr.code });
    return fail(ctx.t("errors.generic"));
  }
  // Non-secret metadata through the user's client → RLS + audit trail with the actor's name.
  const { error } = await ctx.supabase.from("integration_settings").upsert({
    organization_id: ctx.org.id, provider: "mapon", has_secret: true, secret_hint: key.slice(-4), enabled: true,
    updated_by: ctx.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,provider" });
  if (error) return dbFail("integrations.mapon_meta", error);

  const test = await testConnection(ctx.org.id);
  revalidatePath(PATH);
  if (!test.ok) return maponFail(ctx, test.code);
  return { ok: true, message: `${ctx.t("integrations.mapon.keySaved")} · ${ctx.t("integrations.mapon.testOkCount", { n: test.data.units })}` };
}

export async function removeMaponKey(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const { ctx, denied } = await integrationsCtx();
  if (denied) return denied;
  const admin = createAdminClient();
  const { error: delErr } = await admin.from("integration_secrets").delete().eq("organization_id", ctx.org.id).eq("provider", "mapon");
  if (delErr) {
    logServerError("integrations.mapon_secret_delete", { code: delErr.code });
    return fail(ctx.t("errors.generic"));
  }
  const envKey = Boolean(serverEnv.maponApiKey);
  const { error } = await ctx.supabase.from("integration_settings").update({
    has_secret: false, secret_hint: null, enabled: envKey, status: envKey ? "connected" : "not_configured", last_error: null,
    updated_by: ctx.user.id, updated_at: new Date().toISOString(),
  }).eq("organization_id", ctx.org.id).eq("provider", "mapon");
  if (error) return dbFail("integrations.mapon_meta", error);
  revalidatePath(PATH);
  return { ok: true, message: ctx.t("integrations.mapon.keyRemoved") };
}

/* ------------------------------------------------------------ test / sync */
export async function testMapon(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const { ctx, denied } = await integrationsCtx();
  if (denied) return denied;
  if (!rateLimit(`mapon-test:${ctx.org.id}`, 6, 60_000).ok) return maponFail(ctx, "rate_limited");
  const res = await testConnection(ctx.org.id);
  revalidatePath(PATH);
  if (!res.ok) return maponFail(ctx, res.code);
  return { ok: true, message: ctx.t("integrations.mapon.testOkCount", { n: res.data.units }) };
}

export async function syncMapon(_prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const { ctx, denied } = await integrationsCtx();
  if (denied) return denied;
  if (!rateLimit(`mapon-sync:${ctx.org.id}`, 4, 60_000).ok) return maponFail(ctx, "rate_limited");
  const res = await syncUnits(ctx.org.id);
  revalidatePath(PATH);
  revalidatePath("/map");
  revalidatePath("/dashboard");
  if (!res.ok) return maponFail(ctx, res.code);
  return { ok: true, message: ctx.t("integrations.mapon.syncOkSummary", { units: res.data.units, positions: res.data.positions }) };
}

/* ------------------------------------------------------------ device ↔ machine link */
export async function linkMaponDevice(deviceId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_integrations")) return fail(ctx.t("errors.permission"));
  if (!z.string().uuid().safeParse(deviceId).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(z.object({ machine_id: zf.optUuid() }), fd);
  if (!parsed.ok) return parsed.result;
  const machineId = parsed.data.machine_id ?? null;

  if (machineId) {
    // Never trust client ids: the machine must belong to this organization.
    const { data: machine } = await ctx.supabase.from("machines").select("id").eq("id", machineId)
      .eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
    if (!machine) return fail(ctx.t("errors.notFound"));
    // One Mapon unit per machine: release any previous link.
    const { error: relErr } = await ctx.supabase.from("mapon_devices").update({ machine_id: null })
      .eq("organization_id", ctx.org.id).eq("machine_id", machineId).neq("id", deviceId);
    if (relErr) return dbFail("integrations.mapon_unlink", relErr);
  }
  const { error } = await ctx.supabase.from("mapon_devices").update({ machine_id: machineId })
    .eq("id", deviceId).eq("organization_id", ctx.org.id);
  if (error) return dbFail("integrations.mapon_link", error);
  revalidatePath(PATH);
  return { ok: true, message: ctx.t("integrations.mapon.linked") };
}
