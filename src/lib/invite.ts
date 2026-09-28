import "server-only";
import { createHash, randomBytes } from "node:crypto";
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

/** Invitation link validity. */
export const INVITE_VALID_DAYS = 7;

export type InviteInput = {
  ctx: OrgContext;
  email: string;
  fullName: string;
  role: RoleKey;
  /** Link the new account to an existing employee record instead of creating one. */
  employeeId?: string | null;
};

export type InviteResult = { userId: string; link: string | null; expiresAt: string | null; existing: boolean };

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

async function linkFor(token: string) {
  const { origin } = await requestMeta();
  return `${appBaseUrl(origin)}/invite/${token}`;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Roles the current user may hand out: owners (and the platform developer) may also create owners. */
export function grantableRoles(ctx: OrgContext): RoleKey[] {
  const isOwner = ctx.roles.includes("owner") || ctx.user.app_metadata?.platform_role === "developer";
  const base = INVITABLE_ROLES.filter((r) => r !== "admin" || ctx.can("manage_permissions") || isOwner);
  return isOwner ? (["owner", ...base] as RoleKey[]) : base;
}

/**
 * Creates the person's account + profile + membership right away and returns a
 * one-time invitation link (valid 7 days) that the admin can copy or share.
 * No e-mail is sent, so it works without custom SMTP. On first sign-in the
 * person MUST set their own password (app_metadata.must_change_password).
 *
 * If the e-mail already has an account (e.g. member of the DEMO organization),
 * only the membership is added and no link is needed.
 */
export async function inviteUser({ ctx, email, fullName, role, employeeId }: InviteInput): Promise<ActionResult<InviteResult>> {
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!grantableRoles(ctx).includes(role)) return fail(ctx.t("users.privilegedRole"));
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
  if (!rateLimit(`invite:${ctx.user.id}`, 30, 60 * 60 * 1000).ok) return fail(ctx.t("errors.rateLimited"));

  if (employeeId) {
    if (!z.string().uuid().safeParse(employeeId).success) return fail(ctx.t("errors.validation"));
    const { data: emp } = await ctx.supabase.from("employees").select("id, user_id")
      .eq("id", employeeId).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
    if (!emp) return fail(ctx.t("errors.notFound"));
    if (emp.user_id) return fail(ctx.t("users.employeeHasAccount"));
  }

  const admin = createAdminClient();
  const { first, last } = splitName(name);

  const { data: existing } = await admin.from("profiles").select("id").eq("email", mail).maybeSingle();
  let userId: string;
  let createdNow = false;
  if (existing) {
    userId = existing.id;
    const { data: member } = await admin.from("organization_members").select("status")
      .eq("organization_id", ctx.org.id).eq("user_id", userId).maybeSingle();
    if (member) return fail(ctx.t("users.alreadyMember"));
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: mail,
      email_confirm: true,
      user_metadata: { full_name: name },
      app_metadata: { must_change_password: true },
    });
    if (error || !data.user) {
      logServerError("invite.create_user", { status: error?.status, code: error?.code, message: error?.message });
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
    if (createdNow) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return fail(ctx.t("errors.generic"));
  }

  // close stale open invitations for this e-mail, then record the new one
  await admin.from("invitations").update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id).ilike("email", mail.replace(/[\\%_]/g, (c) => `\\${c}`))
    .is("accepted_at", null).is("revoked_at", null);

  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString();
  const tok = createdNow ? newToken() : null;
  const { error: invErr } = await admin.from("invitations").insert({
    organization_id: ctx.org.id, email: mail, employee_id: employeeId ?? null, role_key: role, invited_by: ctx.user.id,
    user_id: userId, expires_at: expiresAt, token_hash: tok?.hash ?? null,
    accepted_at: createdNow ? null : new Date().toISOString(),
  });
  if (invErr) {
    logServerError("invite.record", { code: invErr.code, message: invErr.message });
    return fail(ctx.t("errors.generic"));
  }

  return {
    ok: true,
    message: createdNow ? ctx.t("users.linkReady") : ctx.t("users.addedExisting"),
    data: { userId, link: tok ? await linkFor(tok.token) : null, expiresAt: tok ? expiresAt : null, existing: !createdNow },
  };
}

/**
 * Generates a NEW link for a pending invitation (the old one stops working)
 * and extends it by 7 days. The person must set a password on first sign-in.
 */
export async function regenerateInvitation(ctx: OrgContext, invitationId: string): Promise<ActionResult<InviteResult>> {
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!hasServiceRole()) return fail(ctx.t("users.serviceKeyMissing"));
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invitations").select("id, user_id, accepted_at, revoked_at")
    .eq("id", invitationId).eq("organization_id", ctx.org.id).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at || !inv.user_id) return fail(ctx.t("errors.notFound"));

  const tok = newToken();
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString();
  const { error } = await admin.from("invitations").update({ token_hash: tok.hash, expires_at: expiresAt, opened_at: null }).eq("id", inv.id);
  if (error) {
    logServerError("invite.regenerate", { code: error.code, message: error.message });
    return fail(ctx.t("errors.generic"));
  }
  const { data: u } = await admin.auth.admin.getUserById(inv.user_id);
  await admin.auth.admin.updateUserById(inv.user_id, { app_metadata: { ...(u.user?.app_metadata ?? {}), must_change_password: true } });
  return { ok: true, message: ctx.t("users.linkReady"), data: { userId: inv.user_id, link: await linkFor(tok.token), expiresAt, existing: false } };
}

/** Backwards-compatible name used by older call sites. */
export const resendInvitation = regenerateInvitation;
