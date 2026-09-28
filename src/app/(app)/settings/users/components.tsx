"use client";

import { Check, Lock, Mail, RotateCw, ShieldOff, ShieldCheck, UserCog, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, type FormAction } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { PERMISSION_GROUPS, type RoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { changeMemberRole, inviteUserAction, resendInvitationAction, revokeInvitation, setMemberStatus, setRolePermission } from "./actions";

/* ------------------------------------------------------------ invite */

export type InviteEmployee = { id: string; full_name: string | null; email: string | null };

export function InviteDialog({ roles, employees, defaultOpen, disabled }: {
  roles: RoleKey[]; employees: InviteEmployee[]; defaultOpen?: boolean; disabled?: boolean;
}) {
  const { t } = useT();
  if (disabled) {
    return <Button disabled><UserPlus className="h-4 w-4" /> {t("users.invite")}</Button>;
  }
  return (
    <FormDialog size="md" title={t("users.invite")} description={t("users.inviteHint")} action={inviteUserAction as FormAction}
      submitLabel={<><Mail className="h-4 w-4" /> {t("common.send")}</>} defaultOpen={defaultOpen}
      trigger={<Button><UserPlus className="h-4 w-4" /> {t("users.invite")}</Button>}>
      <InviteFields roles={roles} employees={employees} />
    </FormDialog>
  );
}

/** Remounted on every dialog open, so the fields always start empty. */
function InviteFields({ roles, employees }: { roles: RoleKey[]; employees: InviteEmployee[] }) {
  const { t, label } = useT();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const onEmployee = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    if (!name && e.full_name) setName(e.full_name);
    if (!email && e.email) setEmail(e.email);
  };
  return (
    <div className="space-y-4">
      {employees.length > 0 && (
        <Select name="employee_id" label={t("users.linkEmployee")} hint={t("users.linkEmployeeHint")} placeholder="" optional
          options={employees.map((e) => ({ value: e.id, label: [e.full_name, e.email].filter(Boolean).join(" · ") }))}
          onChange={(ev) => onEmployee(ev.target.value)} />
      )}
      <FormGrid>
        <Input name="full_name" label={t("users.fullName")} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={200} autoComplete="off" />
        <Input name="email" type="email" label={t("users.email")} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="off" inputMode="email" />
      </FormGrid>
      <Select name="role" label={t("users.role")} defaultValue="employee" options={roles.map((r) => ({ value: r, label: label("users.roleNames", r) }))} />
    </div>
  );
}

/* ------------------------------------------------------------ members */

export function ChangeRoleDialog({ userId, name, current, roles }: { userId: string; name: string; current: string; roles: RoleKey[] }) {
  const { t, label } = useT();
  return (
    <FormDialog size="sm" title={`${t("users.changeRole")}: ${name}`} action={changeMemberRole.bind(null, userId) as FormAction}
      trigger={<Button size="sm" variant="ghost" aria-label={t("users.changeRole")}><UserCog className="h-4 w-4" /><span className="hidden lg:inline">{t("users.changeRole")}</span></Button>}>
      <Select name="role" label={t("users.role")} defaultValue={current} options={roles.map((r) => ({ value: r, label: label("users.roleNames", r) }))} />
    </FormDialog>
  );
}

export function MemberStatusButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  const { t } = useT();
  return disabled ? (
    <ActionButton action={setMemberStatus.bind(null, userId, "active") as FormAction} variant="ghost" size="sm">
      <ShieldCheck className="h-4 w-4" /><span className="hidden lg:inline">{t("users.enable")}</span>
    </ActionButton>
  ) : (
    <ActionButton action={setMemberStatus.bind(null, userId, "disabled") as FormAction} variant="ghost" size="sm" confirm={t("users.confirmDisable")}
      className="text-crit hover:text-crit">
      <ShieldOff className="h-4 w-4" /><span className="hidden lg:inline">{t("users.disable")}</span>
    </ActionButton>
  );
}

/* ------------------------------------------------------------ invitations */

export function InvitationActions({ id }: { id: string }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1">
      <ActionButton action={resendInvitationAction.bind(null, id) as FormAction} variant="ghost" size="sm">
        <RotateCw className="h-4 w-4" /><span className="hidden lg:inline">{t("users.resend")}</span>
      </ActionButton>
      <ActionButton action={revokeInvitation.bind(null, id) as FormAction} variant="ghost" size="sm" confirm={t("users.confirmRevoke")} className="text-crit hover:text-crit">
        <X className="h-4 w-4" /><span className="hidden lg:inline">{t("users.revoke")}</span>
      </ActionButton>
    </span>
  );
}

/* ------------------------------------------------------------ permission matrix */

export type MatrixRole = { id: string; key: string; name: string };

export function PermissionMatrix({ roles, grants, editable }: { roles: MatrixRole[]; grants: Record<string, string[]>; editable: boolean }) {
  const { t, label } = useT();
  const [state, setState] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, new Set(grants[r.id] ?? [])])));
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = (role: MatrixRole, perm: string) => {
    if (!editable || role.key === "owner") return;
    const on = !state[role.id]?.has(perm);
    const apply = (value: boolean) => setState((s) => {
      const next = new Set(s[role.id]);
      if (value) next.add(perm); else next.delete(perm);
      return { ...s, [role.id]: next };
    });
    apply(on);
    setBusy(`${role.id}:${perm}`);
    startTransition(async () => {
      const res = await setRolePermission(role.id, perm, on);
      if (!res.ok) {
        apply(!on);
        toast(res.error, "error");
      }
      setBusy(null);
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {t("settings.sections.permissions")}
              </th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <span className="inline-flex items-center gap-1">
                    {r.key === "owner" && <Lock className="h-3 w-3 text-amber" aria-label={t("users.ownerLocked")} />}
                    {label("users.roleNames", r.key, r.name)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <PermissionGroupRows key={g.key} groupKey={g.key} perms={g.perms} roles={roles} state={state} busy={busy}
                editable={editable} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionGroupRows({ groupKey, perms, roles, state, busy, editable, onToggle }: {
  groupKey: string; perms: readonly string[]; roles: MatrixRole[]; state: Record<string, Set<string>>; busy: string | null;
  editable: boolean; onToggle: (role: MatrixRole, perm: string) => void;
}) {
  const { t, label } = useT();
  return (
    <>
      <tr className="border-y border-line bg-bg-2/60">
        <th scope="rowgroup" colSpan={roles.length + 1} className="sticky left-0 px-4 py-2 text-left font-display text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          {label("users.permissionGroups", groupKey)}
        </th>
      </tr>
      {perms.map((p) => (
        <tr key={p} className="border-b border-line/60 transition-colors hover:bg-surface-2/40">
          <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal">
            <span className="block text-ink">{label("users.permissionNames", p)}</span>
            <code className="text-[10px] text-faint">{p}</code>
          </th>
          {roles.map((r) => {
            const locked = r.key === "owner";
            const on = locked || state[r.id]?.has(p);
            const isBusy = busy === `${r.id}:${p}`;
            return (
              <td key={r.id} className="px-2 py-2 text-center">
                <button type="button" role="switch" aria-checked={on} disabled={!editable || locked || isBusy}
                  aria-label={`${label("users.roleNames", r.key, r.name)}: ${label("users.permissionNames", p)}`}
                  title={locked ? t("users.ownerLocked") : undefined}
                  onClick={() => onToggle(r, p)}
                  className={cn("inline-grid h-8 w-8 place-items-center rounded-lg border transition-all duration-150",
                    on ? "border-forest-600/60 bg-forest-700/40 text-moss" : "border-line bg-surface-2/40 text-transparent",
                    editable && !locked && "hover:border-amber/60 active:scale-95",
                    (!editable || locked) && "cursor-default",
                    isBusy && "animate-pulse")}>
                  {on ? (locked ? <Lock className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />) : <span className="h-1 w-1 rounded-full bg-faint" />}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
