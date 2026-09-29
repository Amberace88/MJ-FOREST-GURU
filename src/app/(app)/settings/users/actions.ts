"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { requireOrg } from "@/lib/context";
import { hasServiceRole } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeveloper, setLoginFrozen } from "@/lib/login-freeze";
import { grantableRoles, inviteUser, resendInvitation } from "@/lib/invite";
import { PERMISSIONS, ROLE_KEYS, type RoleKey } from "@/lib/permissions";

const PATH = "/settings/users";
const PRIVILEGED: readonly string[] = ["owner", "admin"];
const uuid = z.string().uuid();

/* ------------------------------------------------------------ invite */
const inviteSchema = z.object({
  email: zf.email(),
  full_name: zf.reqText(200),
  role: z.enum(ROLE_KEYS as unknown as [RoleKey, ...RoleKey[]]),
  employee_id: zf.optUuid(),
});

export async function inviteUserAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(inviteSchema, fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  const res = await inviteUser({ ctx, email: d.email, fullName: d.full_name, role: d.role, employeeId: d.employee_id ?? null });
  if (res.ok) {
    revalidatePath(PATH);
    revalidatePath("/employees");
  }
  return res;
}

export async function resendInvitationAction(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  // no revalidatePath: the dialog refreshes the page itself after showing the link
  return resendInvitation(ctx, id);
}

export async function revokeInvitation(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { data: inv } = await ctx.supabase.from("invitations").select("id, user_id, accepted_at, revoked_at")
    .eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return fail(ctx.t("errors.notFound"));

  const { error } = await ctx.supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
  if (error) return dbFail("users.revoke", error);

  // The account was created at invite time: if it never signed in, block its membership too.
  if (inv.user_id && inv.user_id !== ctx.user.id) {
    const { data: profile } = await ctx.supabase.from("profiles").select("last_login_at").eq("id", inv.user_id).maybeSingle();
    if (!profile?.last_login_at) {
      const { error: mErr } = await ctx.supabase.from("organization_members").update({ status: "disabled" })
        .eq("organization_id", ctx.org.id).eq("user_id", inv.user_id);
      if (mErr) return dbFail("users.revoke_member", mErr);
    }
  }
  revalidatePath(PATH);
  return { ok: true, message: ctx.t("users.revoked") };
}

/* ------------------------------------------------------------ prepared accounts (e-mail later) */
const prepareSchema = z.object({
  full_name: zf.reqText(200),
  role: z.enum(ROLE_KEYS as unknown as [RoleKey, ...RoleKey[]]),
});

/** Reserve a seat (name + role) before the person's e-mail is known. */
export async function prepareAccountAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  const parsed = parseForm(prepareSchema, fd);
  if (!parsed.ok) return parsed.result;
  if (!grantableRoles(ctx).includes(parsed.data.role)) return fail(ctx.t("users.privilegedRole"));
  const { error } = await ctx.supabase.from("invitations").insert({
    organization_id: ctx.org.id, email: null, full_name: parsed.data.full_name.trim(), role_key: parsed.data.role,
    invited_by: ctx.user.id, expires_at: new Date(Date.now() + 3650 * 86_400_000).toISOString(),
  });
  if (error) return dbFail("users.prepare", error);
  revalidatePath(PATH);
  revalidatePath("/setup");
  return { ok: true, message: ctx.t("users.prepared.saved") };
}

const activateSchema = z.object({ email: zf.email(), full_name: zf.reqText(200) });

/** Enter the e-mail of a prepared account → create the account + one-time link, close the draft. */
export async function activatePreparedAction(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(activateSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { data: draft } = await ctx.supabase.from("invitations").select("id, role_key, email, revoked_at")
    .eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!draft || draft.email || draft.revoked_at) return fail(ctx.t("errors.notFound"));
  const role = draft.role_key as RoleKey;
  const res = await inviteUser({ ctx, email: parsed.data.email, fullName: parsed.data.full_name, role });
  if (res.ok) {
    await ctx.supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.org.id);
    revalidatePath(PATH);
    revalidatePath("/setup");
  }
  return res;
}

export async function removePreparedAction(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(id).success) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("invitations").update({ revoked_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", ctx.org.id).is("email", null);
  if (error) return dbFail("users.prepared_remove", error);
  revalidatePath(PATH);
  revalidatePath("/setup");
  return { ok: true, message: ctx.t("users.prepared.removed") };
}

/* ------------------------------------------------------------ members */
async function rolesOf(ctx: Awaited<ReturnType<typeof requireOrg>>, userId: string) {
  const { data } = await ctx.supabase.from("user_roles").select("id, role_id, roles(key)").eq("organization_id", ctx.org.id).eq("user_id", userId);
  return (data ?? []).map((r) => ({ id: r.id, role_id: r.role_id, key: (r.roles as { key: string } | null)?.key ?? "" }));
}

async function activeOwnerCount(ctx: Awaited<ReturnType<typeof requireOrg>>, excludeUser: string) {
  const { data: ownerRole } = await ctx.supabase.from("roles").select("id").eq("organization_id", ctx.org.id).eq("key", "owner").maybeSingle();
  if (!ownerRole) return 0;
  const { data: owners } = await ctx.supabase.from("user_roles").select("user_id").eq("organization_id", ctx.org.id).eq("role_id", ownerRole.id);
  const ids = (owners ?? []).map((o) => o.user_id).filter((u) => u !== excludeUser);
  if (ids.length === 0) return 0;
  const { count } = await ctx.supabase.from("organization_members").select("user_id", { count: "exact", head: true })
    .eq("organization_id", ctx.org.id).eq("status", "active").in("user_id", ids);
  return count ?? 0;
}

export async function changeMemberRole(userId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(userId).success) return fail(ctx.t("errors.validation"));
  if (userId === ctx.user.id) return fail(ctx.t("users.cannotEditSelf"));
  if (!isDeveloper(ctx.user) && hasServiceRole()) {
    const { data: tu } = await createAdminClient().auth.admin.getUserById(userId);
    if (isDeveloper(tu.user)) return fail(ctx.t("errors.permission"));
  }
  const parsed = parseForm(z.object({ role: z.enum(ROLE_KEYS) }), fd);
  if (!parsed.ok) return parsed.result;
  const roleKey = parsed.data.role;

  const current = await rolesOf(ctx, userId);
  const touchesPrivileged = PRIVILEGED.includes(roleKey) || current.some((r) => PRIVILEGED.includes(r.key));
  if (touchesPrivileged && !ctx.can("manage_permissions")) return fail(ctx.t("users.privilegedRole"));

  const { data: member } = await ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.org.id).eq("user_id", userId).maybeSingle();
  if (!member) return fail(ctx.t("errors.notFound"));
  const { data: role } = await ctx.supabase.from("roles").select("id").eq("organization_id", ctx.org.id).eq("key", roleKey).maybeSingle();
  if (!role) return fail(ctx.t("errors.notFound"));

  let insertedId: string | null = null;
  if (!current.some((r) => r.role_id === role.id)) {
    const { data: ins, error } = await ctx.supabase.from("user_roles")
      .insert({ organization_id: ctx.org.id, user_id: userId, role_id: role.id, granted_by: ctx.user.id }).select("id").single();
    if (error) return dbFail("users.role_grant", error);
    insertedId = ins.id;
  }
  // One statement: the DB guard (LAST_OWNER) rejects it atomically if the last owner would disappear.
  const { error: delErr } = await ctx.supabase.from("user_roles").delete()
    .eq("organization_id", ctx.org.id).eq("user_id", userId).neq("role_id", role.id);
  if (delErr) {
    if (insertedId) await ctx.supabase.from("user_roles").delete().eq("id", insertedId);
    return dbFail("users.role_revoke", delErr);
  }
  revalidatePath(PATH);
  return { ok: true, message: ctx.t("users.roleChanged") };
}

export async function setMemberStatus(userId: string, status: "active" | "disabled", _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(userId).success || !["active", "disabled"].includes(status)) return fail(ctx.t("errors.validation"));
  if (userId === ctx.user.id) return fail(ctx.t("users.cannotEditSelf"));
  if (!isDeveloper(ctx.user) && hasServiceRole()) {
    const { data: tu } = await createAdminClient().auth.admin.getUserById(userId);
    if (isDeveloper(tu.user)) return fail(ctx.t("errors.permission"));
  }

  const current = await rolesOf(ctx, userId);
  if (current.some((r) => PRIVILEGED.includes(r.key)) && !ctx.can("manage_permissions")) return fail(ctx.t("users.privilegedRole"));
  if (status === "disabled" && current.some((r) => r.key === "owner") && (await activeOwnerCount(ctx, userId)) === 0) {
    return fail(ctx.t("errors.lastOwner"));
  }
  const { error } = await ctx.supabase.from("organization_members").update({ status })
    .eq("organization_id", ctx.org.id).eq("user_id", userId);
  if (error) return dbFail("users.status", error);
  revalidatePath(PATH);
  return { ok: true, message: status === "disabled" ? ctx.t("users.disabled") : ctx.t("users.enabled") };
}

/* ------------------------------------------------------------ remove user from the organization */
/**
 * Removes a person's access to this organization: membership, roles and open invitations.
 * The employee card stays (history), only unlinked. If the account never signed in and
 * belongs to no other organization, the login itself is deleted too (a mistyped invite).
 */
export async function removeMember(userId: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_users")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(userId).success) return fail(ctx.t("errors.validation"));
  if (userId === ctx.user.id) return fail(ctx.t("users.cannotEditSelf"));
  if (!hasServiceRole()) return fail(ctx.t("users.serviceKeyMissing"));
  const current = await rolesOf(ctx, userId);
  if (current.some((r) => PRIVILEGED.includes(r.key)) && !ctx.can("manage_permissions")) return fail(ctx.t("users.privilegedRole"));
  if (current.some((r) => r.key === "owner") && (await activeOwnerCount(ctx, userId)) === 0) return fail(ctx.t("errors.lastOwner"));

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(userId);
  if (target.user?.app_metadata?.platform_role === "developer") return fail(ctx.t("errors.permission"));
  const org = ctx.org.id;
  const now = new Date().toISOString();
  await admin.from("invitations").update({ revoked_at: now }).eq("organization_id", org).eq("user_id", userId).is("accepted_at", null).is("revoked_at", null);
  await admin.from("user_roles").delete().eq("organization_id", org).eq("user_id", userId);
  const { error } = await admin.from("organization_members").delete().eq("organization_id", org).eq("user_id", userId);
  if (error) return dbFail("users.remove", error);
  await admin.from("employees").update({ user_id: null }).eq("organization_id", org).eq("user_id", userId);

  const { count } = await admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count && !target.user?.last_sign_in_at) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  revalidatePath(PATH);
  revalidatePath("/employees");
  return { ok: true, message: "Lietotājs noņemts" };
}

/* ------------------------------------------------------------ permission matrix */
export async function setRolePermission(roleId: string, permission: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_permissions")) return fail(ctx.t("errors.permission"));
  if (!uuid.safeParse(roleId).success || !(PERMISSIONS as readonly string[]).includes(permission) || typeof enabled !== "boolean") {
    return fail(ctx.t("errors.validation"));
  }
  const { data: role } = await ctx.supabase.from("roles").select("id, key").eq("id", roleId).eq("organization_id", ctx.org.id).maybeSingle();
  if (!role) return fail(ctx.t("errors.notFound"));
  if (role.key === "owner") return fail(ctx.t("users.ownerLocked"));

  if (enabled) {
    const { error } = await ctx.supabase.from("role_permissions").insert({ role_id: roleId, permission_key: permission, organization_id: ctx.org.id });
    if (error && error.code !== "23505") return dbFail("users.perm_grant", error);
  } else {
    const { error } = await ctx.supabase.from("role_permissions").delete()
      .eq("role_id", roleId).eq("permission_key", permission).eq("organization_id", ctx.org.id);
    if (error) return dbFail("users.perm_revoke", error);
  }
  revalidatePath(PATH);
  return { ok: true };
}

/* ------------------------------------------------------------ login freeze (platform developer only) */
async function developerGuard() {
  const ctx = await requireOrg();
  if (!isDeveloper(ctx.user)) return { ctx, error: fail("Tikai lapas izstrādātājs var iesaldēt pieteikšanos") };
  if (!hasServiceRole()) return { ctx, error: fail(ctx.t("users.serviceKeyMissing")) };
  return { ctx, error: null };
}

/** Checkbox "Pieteikšanās iesaldēta" on a user row. */
export async function setLoginFrozenAction(userId: string, frozen: boolean): Promise<ActionResult> {
  const { ctx, error } = await developerGuard();
  if (error) return error;
  if (!uuid.safeParse(userId).success) return fail(ctx.t("errors.validation"));
  if (userId === ctx.user.id) return fail("Savu kontu iesaldēt nevar");
  const { data: m } = await ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.org.id).eq("user_id", userId).maybeSingle();
  if (!m) return fail(ctx.t("errors.notFound"));
  const r = await setLoginFrozen(userId, frozen, ctx.user.id);
  if (!r.ok) return fail(r.error);
  revalidatePath(PATH);
  return { ok: true, message: frozen ? "Pieteikšanās iesaldēta" : "Pieteikšanās atjaunota" };
}

/** Freeze / unfreeze every member of this organization except the developer. */
export async function setAllFrozenAction(frozen: boolean, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await developerGuard();
  if (error) return error;
  const { data: members } = await ctx.supabase.from("organization_members").select("user_id").eq("organization_id", ctx.org.id);
  let n = 0;
  for (const m of members ?? []) {
    if (m.user_id === ctx.user.id) continue;
    const r = await setLoginFrozen(m.user_id, frozen, ctx.user.id);
    if (r.ok) n++;
  }
  revalidatePath(PATH);
  return { ok: true, message: frozen ? `Iesaldēti ${n} lietotāji — ieiet var tikai tu` : `Pieteikšanās atjaunota ${n} lietotājiem` };
}
