import "server-only";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions";
import type { OrgContext } from "@/lib/context";
import { appBaseUrl } from "@/lib/env";
import { hasServiceRole } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { INVITABLE_ROLES, type RoleKey } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";

/** Application-level invitation validity (the Supabase email link itself expires per Auth "Email OTP expiry"). */
export const INVITE_VALID_DAYS = 7;

export type InviteInput = {
  ctx: OrgContext;
  email: string;
  fullName: string;
  role: RoleKey;
  /** Link the new account to an existing employee record instead of creating one. */
  employeeId?: string | null;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function inviteRedirectUrl(origin?: string | null) {
  return `${appBaseUrl(origin)}/auth/confirm?next=/reset-password`;
}

/**
 * Invites a user into the current organization (spec §129–130).
 *
 * 1. Permission checks with the caller's own context (manage_users; admin role
 *    additionally needs manage_permissions — the service role bypasses the DB
 *    guard, so it is re-checked here).
 * 2. New e-mail  → Supabase `auth.admin.inviteUserByEmail` (Latvian template,
 *    link → /auth/confirm → /reset-password) and membership via the
 *    service-role-only RPC `add_organization_member`.
 *    Existing account → membership only (no new e-mail account).
 * 3. `invitations` row written with the caller's client (RLS + audit trail),
 *    valid for 7 days.
 * Public sign-up stays disabled: accounts only exist through this path.
 */
export async function inviteUser({ ctx, email, fullName, role, employeeId }: InviteInput): Promise<ActionResult<{ userId: string }>> {
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!INVITABLE_ROLES.includes(role)) return fail(ctx.t("errors.validation"));
  if (role === "admin" && !ctx.can("manage_permissions")) return fail(ctx.t("users.privilegedRole"));
  if (!hasServiceRole()) return fail(ctx.t("users.serviceKeyMissing"));

  const emailParsed = z.string().trim().toLowerCase().email().max(200).safeParse(email);
  const name = fullName.trim().slice(0, 200);
  if (!emailParsed.success || name.length < 2) {
    return fail(ctx.t("errors.validation"), {
      ...(emailParsed.success ? {} : { email: ctx.t("errors.validation") }),
      ...(name.length < 2 ? { full_name: ctx.t("errors.validation") } : {}),
    });
  }
  const mail = emailParsed.data;
  const limit = rateLimit(`invite:${ctx.user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return fail(ctx.t("errors.rateLimited"));

  // Employee link must be a visible, unlinked employee of THIS organization.
  if (employeeId) {
    if (!z.string().uuid().safeParse(employeeId).success) return fail(ctx.t("errors.validation"));
    const { data: emp } = await ctx.supabase.from("employees").select("id, user_id")
      .eq("id", employeeId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
    if (!emp) return fail(ctx.t("errors.notFound"));
    if (emp.user_id) return fail(ctx.t("users.employeeHasAccount"));
  }

  const { data: openInvite } = await ctx.supabase.from("invitations").select("id, expires_at")
    .eq("organization_id", ctx.org.id).ilike("email", mail.replace(/[\\%_]/g, (c) => `\\${c}`)).is("accepted_at", null).is("revoked_at", null).maybeSingle();
  if (openInvite && new Date(openInvite.expires_at).getTime() > Date.now()) return fail(ctx.t("users.alreadyInvited"));

  const admin = createAdminClient();
  const { first, last } = splitName(name);

  // Existing account? (profiles.email mirrors auth.users.email; Supabase stores e-mails lower-case)
  const { data: existing } = await admin.from("profiles").select("id").eq("email", mail).maybeSingle();
  let userId: string;
  let createdNow = false;

  if (existing) {
    userId = existing.id;
    const { data: member } = await admin.from("organization_members").select("status")
      .eq("organization_id", ctx.org.id).eq("user_id", userId).maybeSingle();
    if (member) return fail(ctx.t("users.alreadyMember"));
  } else {
    const { origin } = await requestMeta();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(mail, {
      redirectTo: inviteRedirectUrl(origin),
      data: { full_name: name, organization: ctx.org.name },
    });
    if (error || !data.user) {
      logServerError("invite.send", { status: error?.status, code: error?.code, message: error?.message });
      return fail(ctx.t("users.inviteFailed"));
    }
    userId = data.user.id;
    createdNow = true;
  }

  const { error: rpcError } = await admin.rpc("add_organization_member", {
    p_org: ctx.org.id, p_user: userId, p_role_key: role, p_employee_id: employeeId ?? undefined,
    p_first_name: first || undefined, p_last_name: last, p_invited_by: ctx.user.id,
  });
  if (rpcError) {
    logServerError("invite.add_member", { code: rpcError.code, message: rpcError.message });
    if (createdNow) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) logServerError("invite.rollback", { message: delErr.message });
    }
    return fail(ctx.t("errors.generic"));
  }

  // Close any stale (expired) open invitation for the same e-mail, then record this one.
  if (openInvite) {
    await ctx.supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", openInvite.id);
  }
  const { error: invErr } = await ctx.supabase.from("invitations").insert({
    organization_id: ctx.org.id, email: mail, employee_id: employeeId ?? null, role_key: role, invited_by: ctx.user.id,
    user_id: userId, expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString(),
    accepted_at: createdNow ? null : new Date().toISOString(),
  });
  if (invErr) logServerError("invite.record", { code: invErr.code, message: invErr.message });

  return {
    ok: true,
    message: createdNow ? ctx.t("users.inviteSent", { email: mail }) : ctx.t("users.addedExisting"),
    data: { userId },
  };
}

/**
 * Re-sends the invitation e-mail for a pending invitation and extends it by 7 days.
 * If Supabase refuses a second invite (account already confirmed), a password
 * recovery e-mail is sent instead — it lets the user set a password just the same.
 */
export async function resendInvitation(ctx: OrgContext, invitationId: string): Promise<ActionResult> {
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!hasServiceRole()) return fail(ctx.t("users.serviceKeyMissing"));
  const limit = rateLimit(`invite:${ctx.user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return fail(ctx.t("errors.rateLimited"));

  const { data: inv } = await ctx.supabase.from("invitations").select("id, email, accepted_at, revoked_at")
    .eq("id", invitationId).eq("organization_id", ctx.org.id).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return fail(ctx.t("errors.notFound"));

  const admin = createAdminClient();
  const { origin } = await requestMeta();
  const redirectTo = inviteRedirectUrl(origin);
  const { error } = await admin.auth.admin.inviteUserByEmail(inv.email, { redirectTo });
  if (error) {
    const { error: recErr } = await admin.auth.resetPasswordForEmail(inv.email, { redirectTo: `${appBaseUrl(origin)}/auth/confirm?next=/reset-password` });
    if (recErr) {
      logServerError("invite.resend", { message: recErr.message });
      return fail(ctx.t("users.inviteFailed"));
    }
  }
  const { error: updErr } = await ctx.supabase.from("invitations")
    .update({ expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString() }).eq("id", inv.id);
  if (updErr) logServerError("invite.extend", { code: updErr.code, message: updErr.message });
  return { ok: true, message: ctx.t("users.resent") };
}
