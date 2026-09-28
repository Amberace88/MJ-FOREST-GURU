"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createT, getDictionary } from "@/i18n";
import type { ActionResult } from "@/lib/actions";
import { appBaseUrl, isSupabaseConfigured } from "@/lib/env";
import { hasServiceRole } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requestMeta, safeNext } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const { t } = createT(getDictionary("lv"));

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

async function auditFailedLogin(email: string, ip: string, userAgent: string, reason: string) {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    // Attach the event to the organizations of the targeted account (if it exists) so owners can see it.
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    const orgs = profile
      ? ((await admin.from("organization_members").select("organization_id").eq("user_id", profile.id)).data ?? []).map((m) => m.organization_id)
      : [null];
    await admin.from("audit_logs").insert(
      orgs.map((org) => ({
        organization_id: org, user_id: profile?.id ?? null, actor_name: email, action: "login_failed", entity: "auth",
        entity_id: profile?.id ?? null, new_values: { reason }, ip_address: ip, user_agent: userAgent,
      })),
    );
  } catch (e) {
    logServerError("audit.login_failed", e);
  }
}

export async function loginAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: t("errors.notConfigured") };
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password"), next: fd.get("next") ?? undefined });
  if (!parsed.success) return { ok: false, error: t("auth.invalidCredentials") };
  const { email, password, next } = parsed.data;
  const { ip, userAgent } = await requestMeta();

  const byAccount = rateLimit(`login:${email}`, 6, 5 * 60_000);
  const byIp = rateLimit(`login-ip:${ip}`, 30, 5 * 60_000);
  if (!byAccount.ok || !byIp.ok) {
    await auditFailedLogin(email, ip, userAgent, "rate_limited");
    return { ok: false, error: t("auth.tooManyAttempts") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await auditFailedLogin(email, ip, userAgent, error.status === 429 ? "rate_limited" : "invalid_credentials");
    return { ok: false, error: error.status === 429 ? t("auth.tooManyAttempts") : t("auth.invalidCredentials") };
  }
  try {
    await supabase.rpc("log_auth_event", { p_action: "login" });
  } catch (e) {
    logServerError("audit.login", e);
  }
  redirect(safeNext(next));
}

export async function forgotPasswordAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: t("errors.notConfigured") };
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, error: t("errors.validation") };
  const { ip, origin } = await requestMeta();
  if (!rateLimit(`reset:${email.data}`, 3, 15 * 60_000).ok || !rateLimit(`reset-ip:${ip}`, 10, 15 * 60_000).ok) {
    return { ok: false, error: t("auth.tooManyAttempts") };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appBaseUrl(origin)}/auth/callback?next=/reset-password`,
  });
  if (error) logServerError("auth.reset", error);
  if (error?.status === 429) return { ok: false, error: t("auth.tooManyAttempts") };
  // Same answer whether or not the account exists (no account enumeration)
  return { ok: true, message: t("auth.linkSent") };
}

export async function setPasswordAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 10 || password.length > 200) return { ok: false, error: t("auth.passwordRules"), fieldErrors: { password: t("auth.passwordRules") } };
  if (password !== confirm) return { ok: false, error: t("auth.passwordMismatch"), fieldErrors: { confirm: t("auth.passwordMismatch") } };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: t("auth.linkInvalid") };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logServerError("auth.update_password", error);
    return { ok: false, error: t("errors.generic") };
  }
  // UI hint: this browser has confirmed a password (hides the "set password" banner)
  (await cookies()).set("mjfg_pw_set", "1", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 400 });
  // Activate pending invitations for this account (expired ones stay blocked)
  if (hasServiceRole() && user.email) {
    try {
      const admin = createAdminClient();
      const nowIso = new Date().toISOString();
      const { data: invites } = await admin.from("invitations").select("id, organization_id, expires_at")
        .ilike("email", user.email).is("accepted_at", null).is("revoked_at", null);
      for (const inv of invites ?? []) {
        if (inv.expires_at < nowIso) continue;
        await admin.from("invitations").update({ accepted_at: nowIso, user_id: user.id }).eq("id", inv.id);
        await admin.from("organization_members").update({ status: "active", joined_at: nowIso })
          .eq("organization_id", inv.organization_id).eq("user_id", user.id).eq("status", "invited");
      }
    } catch (e) {
      logServerError("auth.accept_invite", e);
    }
  }
  redirect("/dashboard");
}
