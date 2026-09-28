import type { Metadata } from "next";
import { AlertTriangle, KeyRound, MailPlus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi";
import { Avatar, EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requirePermission } from "@/lib/context";
import { hasServiceRole } from "@/lib/env.server";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { grantableRoles } from "@/lib/invite";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";
import { sp as one, statusTone } from "@/lib/utils";
import { ChangeRoleDialog, InvitationActions, InviteDialog, MemberStatusButton, PermissionMatrix, type MatrixRole } from "./components";

export const metadata: Metadata = { title: "Lietotāji un piekļuves" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["members", "invitations", "permissions"] as const;
type Tab = (typeof TABS)[number];

type MemberView = {
  userId: string; name: string; email: string | null; roles: string[]; primaryRole: string;
  status: "invited" | "active" | "disabled"; lastLogin: string | null; employee: { id: string; name: string } | null; isSelf: boolean;
};

type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission("manage_users", "manage_permissions");
  const sp = await searchParams;
  const canUsers = ctx.can("manage_users");
  const canPerms = ctx.can("manage_permissions");
  const available: Tab[] = canUsers ? [...TABS] : ["permissions"];
  const tabParam = one(sp.tab) as Tab | undefined;
  const tab: Tab = tabParam && available.includes(tabParam) ? tabParam : available[0];
  const serviceKey = hasServiceRole();
  const sb = ctx.supabase;
  const org = ctx.org.id;

  const [rolesRes, membersRes, userRolesRes, invitesRes, rolePermsRes] = await Promise.all([
    sb.from("roles").select("id, key, name, rank").eq("organization_id", org).order("rank", { ascending: false }),
    canUsers ? sb.from("organization_members").select("user_id, status, invited_at, joined_at, last_login_at").eq("organization_id", org) : Promise.resolve({ data: [] }),
    canUsers ? sb.from("user_roles").select("user_id, role_id").eq("organization_id", org) : Promise.resolve({ data: [] }),
    canUsers ? sb.from("invitations").select("id, email, role_key, user_id, invited_by, expires_at, accepted_at, revoked_at, created_at")
      .eq("organization_id", org).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    tab === "permissions" ? sb.from("role_permissions").select("role_id, permission_key").eq("organization_id", org) : Promise.resolve({ data: [] }),
  ]);

  const roles = rolesRes.data ?? [];
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const members = membersRes.data ?? [];
  const invites = invitesRes.data ?? [];
  const userIds = Array.from(new Set([...members.map((m) => m.user_id), ...invites.flatMap((i) => [i.user_id, i.invited_by]).filter((x): x is string => Boolean(x))]));

  const [profilesRes, employeesRes, freeEmployeesRes] = await Promise.all([
    userIds.length ? sb.from("profiles").select("id, full_name, email, last_login_at").in("id", userIds) : Promise.resolve({ data: [] }),
    userIds.length ? sb.from("employees").select("id, full_name, user_id").eq("organization_id", org).in("user_id", userIds).is("deleted_at", null) : Promise.resolve({ data: [] }),
    canUsers && ctx.canAny("view_all_employees", "edit_employees", "view_team")
      ? sb.from("employees").select("id, full_name, email").eq("organization_id", org).is("user_id", null).is("deleted_at", null).is("archived_at", null).order("full_name").limit(500)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const employeeByUser = new Map((employeesRes.data ?? []).map((e) => [e.user_id as string, e]));

  const now = Date.now();
  const invitationStatus = (i: (typeof invites)[number]): InvitationStatus => {
    if (i.revoked_at) return "revoked";
    if (i.accepted_at || (i.user_id && profiles.get(i.user_id)?.last_login_at)) return "accepted";
    if (new Date(i.expires_at).getTime() < now) return "expired";
    return "pending";
  };
  const pendingByUser = new Set(invites.filter((i) => i.user_id && invitationStatus(i) === "pending").map((i) => i.user_id as string));

  const rolesByUser = new Map<string, string[]>();
  for (const ur of userRolesRes.data ?? []) {
    const key = roleById.get(ur.role_id)?.key;
    if (key) rolesByUser.set(ur.user_id, [...(rolesByUser.get(ur.user_id) ?? []), key]);
  }
  const rank = (k: string) => roles.find((r) => r.key === k)?.rank ?? 0;

  const memberRows: MemberView[] = members.map((m) => {
    const p = profiles.get(m.user_id);
    const emp = employeeByUser.get(m.user_id);
    const userRoles = (rolesByUser.get(m.user_id) ?? []).sort((a, b) => rank(b) - rank(a));
    const lastLogin = m.last_login_at ?? p?.last_login_at ?? null;
    const status: MemberView["status"] = m.status === "disabled" ? "disabled"
      : m.status === "invited" || (!lastLogin && pendingByUser.has(m.user_id)) ? "invited" : "active";
    return {
      userId: m.user_id, name: p?.full_name || emp?.full_name || p?.email || "—", email: p?.email ?? null, roles: userRoles,
      primaryRole: userRoles[0] ?? "employee", status, lastLogin, employee: emp ? { id: emp.id, name: emp.full_name ?? "" } : null,
      isSelf: m.user_id === ctx.user.id,
    };
  }).sort((a, b) => rank(b.primaryRole) - rank(a.primaryRole) || a.name.localeCompare(b.name, "lv"));

  const assignableRoles: RoleKey[] = ROLE_KEYS.filter((r) => canPerms || (r !== "owner" && r !== "admin"));
  const invitableRoles: RoleKey[] = grantableRoles(ctx);

  const counts = {
    active: memberRows.filter((m) => m.status === "active").length,
    invited: invites.filter((i) => invitationStatus(i) === "pending").length,
    disabled: memberRows.filter((m) => m.status === "disabled").length,
  };

  const tabs = available.map((k) => ({
    key: k, label: ctx.t(`users.tabs.${k}`), href: `/settings/users?tab=${k}`,
    count: k === "invitations" ? counts.invited : k === "members" ? memberRows.length : null,
  }));

  let content: ReactNode;
  if (tab === "members") {
    content = (
      <DataTable rows={memberRows} rowKey={(r) => r.userId}
        empty={<EmptyState icon={<Users className="h-6 w-6" />} title={ctx.t("users.empty")} />}
        columns={[
          { key: "user", header: ctx.t("users.user"), cell: (r) => (
            <span className="flex min-w-0 items-center gap-3">
              <Avatar name={r.name} size={34} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span className="truncate">{r.name}</span>
                  {r.isSelf && <Badge tone="amber">{ctx.t("users.you")}</Badge>}
                </span>
                {r.email && <span className="block truncate text-xs text-muted">{r.email}</span>}
              </span>
            </span>
          ) },
          { key: "roles", header: ctx.t("users.roles"), cell: (r) => (
            <span className="flex flex-wrap justify-end gap-1 md:justify-start">
              {r.roles.length === 0 ? <span className="text-faint">—</span> : r.roles.map((k) => (
                <Badge key={k} tone={k === "owner" ? "amber" : k === "admin" ? "forest" : "neutral"}>{ctx.label("users.roleNames", k)}</Badge>
              ))}
            </span>
          ) },
          { key: "status", header: ctx.t("common.status"), cell: (r) => <Badge tone={statusTone(r.status)} dot>{ctx.label("users.status", r.status)}</Badge> },
          { key: "login", header: ctx.t("users.lastLogin"), cell: (r) => r.lastLogin
            ? <span className="text-ink-2" title={fmtDateTime(r.lastLogin, ctx.timezone)}>{fmtRelative(r.lastLogin)}</span>
            : <span className="text-faint">{ctx.t("users.never")}</span> },
          { key: "employee", header: ctx.t("users.employee"), hideOnMobile: true, cell: (r) => r.employee
            ? <Link href={`/employees/${r.employee.id}`} className="text-ink-2 hover:text-amber">{r.employee.name}</Link>
            : <span className="text-faint">—</span> },
          { key: "actions", header: <span className="sr-only">{ctx.t("common.actions")}</span>, align: "right", cell: (r) => r.isSelf ? null : (
            <span className="inline-flex items-center gap-1">
              {(canPerms || !r.roles.some((k) => k === "owner" || k === "admin")) && (
                <>
                  <ChangeRoleDialog userId={r.userId} name={r.name} current={r.primaryRole} roles={assignableRoles} />
                  <MemberStatusButton userId={r.userId} disabled={r.status === "disabled"} />
                </>
              )}
            </span>
          ) },
        ]} />
    );
  } else if (tab === "invitations") {
    const rows = invites.map((i) => ({ ...i, st: invitationStatus(i) }));
    content = (
      <DataTable rows={rows} rowKey={(r) => r.id}
        empty={<EmptyState icon={<MailPlus className="h-6 w-6" />} title={ctx.t("users.noInvitations")} />}
        columns={[
          { key: "email", header: ctx.t("users.email"), cell: (r) => (
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{r.email}</span>
              {r.user_id && profiles.get(r.user_id)?.full_name && <span className="block truncate text-xs text-muted">{profiles.get(r.user_id)?.full_name}</span>}
            </span>
          ) },
          { key: "role", header: ctx.t("users.role"), cell: (r) => <Badge tone="neutral">{ctx.label("users.roleNames", r.role_key)}</Badge> },
          { key: "status", header: ctx.t("common.status"), cell: (r) => (
            <Badge tone={r.st === "pending" ? "warn" : r.st === "accepted" ? "ok" : r.st === "expired" ? "crit" : "off"} dot pulse={r.st === "pending"}>
              {ctx.label("users.invitationStatus", r.st)}
            </Badge>
          ) },
          { key: "sent", header: ctx.t("users.invitedAt"), hideOnMobile: true, cell: (r) => (
            <span className="text-ink-2">
              {fmtDateTime(r.created_at, ctx.timezone)}
              {r.invited_by && profiles.get(r.invited_by)?.full_name && <span className="block text-xs text-faint">{profiles.get(r.invited_by)?.full_name}</span>}
            </span>
          ) },
          { key: "expires", header: ctx.t("users.expires"), cell: (r) => <span className="tabular text-ink-2">{fmtDateTime(r.expires_at, ctx.timezone)}</span> },
          { key: "actions", header: <span className="sr-only">{ctx.t("common.actions")}</span>, align: "right", cell: (r) =>
            r.st === "pending" || r.st === "expired" ? (serviceKey ? <InvitationActions id={r.id} /> : null) : null },
        ]} />
    );
  } else {
    const grants: Record<string, string[]> = {};
    for (const rp of rolePermsRes.data ?? []) grants[rp.role_id] = [...(grants[rp.role_id] ?? []), rp.permission_key];
    const matrixRoles: MatrixRole[] = roles.map((r) => ({ id: r.id, key: r.key, name: r.name }));
    content = (
      <section className="space-y-3 animate-fade-up">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber" />{ctx.t("users.permissionsHint")}</span>
          {!canPerms && <span className="text-xs text-warn">{ctx.t("users.readOnlyMatrix")}</span>}
        </div>
        <PermissionMatrix roles={matrixRoles} grants={grants} editable={canPerms} />
      </section>
    );
  }

  return (
    <>
      <PageHeader title={ctx.t("users.title")} subtitle={ctx.t("users.subtitle")} back={{ href: "/settings", label: ctx.t("nav.settings") }}
        actions={canUsers && (
          <InviteDialog roles={invitableRoles} disabled={!serviceKey} defaultOpen={serviceKey && one(sp.new) === "1"}
            employees={(freeEmployeesRes.data ?? []).map((e) => ({ id: e.id, full_name: e.full_name, email: e.email }))} />
        )} />
      {canUsers && !serviceKey && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn animate-fade-up">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ctx.t("users.serviceKeyMissing")}
        </div>
      )}
      {canUsers && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <KpiCard label={ctx.label("users.status", "active")} value={counts.active} icon={<ShieldCheck className="h-4 w-4" />} tone="forest" />
          <KpiCard label={ctx.label("users.status", "invited")} value={counts.invited} icon={<MailPlus className="h-4 w-4" />} tone="amber" delay={40} />
          <KpiCard label={ctx.label("users.status", "disabled")} value={counts.disabled} icon={<Users className="h-4 w-4" />} tone="crit" delay={80} />
        </div>
      )}
      <TabNav items={tabs} active={tab} />
      {content}
    </>
  );
}
