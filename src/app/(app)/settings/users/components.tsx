"use client";

import { Check, Lock, MailPlus, RotateCw, ShieldOff, ShieldCheck, Trash2, UserCog, UserPlus, UserRoundPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, type FormAction } from "@/components/ui/form";
import { InviteLinkDialog } from "@/components/shared/invite-link-dialog";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { PERMISSION_GROUPS, type RoleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { activatePreparedAction, changeMemberRole, inviteUserAction, prepareAccountAction, removePreparedAction, resendInvitationAction, revokeInvitation, setMemberStatus, setRolePermission } from "./actions";

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
    <InviteLinkDialog title={t("users.invite")} description={t("users.inviteHint")} action={inviteUserAction as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><UserPlus className="h-4 w-4" /> {t("users.invite")}</Button>}>
      <InviteFields roles={roles} employees={employees} />
    </InviteLinkDialog>
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

/* ------------------------------------------------------------ prepared accounts */

export type PreparedAccount = { id: string; full_name: string; role_key: string };

/**
 * Seats reserved by name + role (e.g. the owners Māris and Jūlija). The admin enters
 * the e-mail later → the account is created and a one-time link is shown.
 */
export function PreparedAccounts({ items, roles, disabled, allowAdd = true }: {
  items: PreparedAccount[]; roles: RoleKey[]; disabled?: boolean; allowAdd?: boolean;
}) {
  const { t, label } = useT();
  if (!items.length && !allowAdd) return null;
  return (
    <section className="card overflow-hidden animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">{t("users.prepared.title")}</h2>
          <p className="text-sm text-muted">{t("users.prepared.hint")}</p>
        </div>
        {allowAdd && (
          <FormDialog size="sm" title={t("users.prepared.add")} action={prepareAccountAction as FormAction}
            trigger={<Button variant="secondary" size="sm"><UserRoundPlus className="h-4 w-4" /> {t("users.prepared.add")}</Button>}>
            <Input name="full_name" label={t("users.fullName")} required minLength={2} maxLength={200} autoComplete="off" />
            <Select name="role" label={t("users.role")} defaultValue="employee" options={roles.map((r) => ({ value: r, label: label("users.roleNames", r) }))} />
          </FormDialog>
        )}
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{t("users.prepared.empty")}</p>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {items.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${i * 60}ms` }}
              className="group flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2/40 px-4 py-3 transition-colors hover:border-amber/50 animate-fade-up">
              <Avatar name={p.full_name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{p.full_name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={p.role_key === "owner" ? "amber" : p.role_key === "admin" ? "forest" : "neutral"}>{label("users.roleNames", p.role_key)}</Badge>
                  <Badge tone="warn" dot pulse>{t("users.prepared.waiting")}</Badge>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {disabled ? (
                  <Button size="sm" disabled><MailPlus className="h-4 w-4" /></Button>
                ) : (
                  <InviteLinkDialog title={`${t("users.prepared.activate")}: ${p.full_name}`} description={t("users.prepared.activateHint")}
                    action={activatePreparedAction.bind(null, p.id) as FormAction} submitLabel={t("users.createAccount")}
                    trigger={<Button size="sm"><MailPlus className="h-4 w-4" /><span className="hidden md:inline">{t("users.prepared.activate")}</span></Button>}>
                    <FormGrid>
                      <Input name="full_name" label={t("users.fullName")} defaultValue={p.full_name} required minLength={2} maxLength={200} autoComplete="off" />
                      <Input name="email" type="email" label={t("users.email")} required maxLength={200} autoComplete="off" inputMode="email" autoFocus />
                    </FormGrid>
                  </InviteLinkDialog>
                )}
                <ActionButton action={removePreparedAction.bind(null, p.id) as FormAction} variant="ghost" size="sm" confirm={t("users.prepared.confirmRemove")}
                  className="text-muted hover:text-crit">
                  <Trash2 className="h-4 w-4" />
                </ActionButton>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <InviteLinkDialog title={t("users.newLink")} description={t("users.linkHint")} action={resendInvitationAction.bind(null, id) as FormAction}
        submitLabel={t("users.newLink")}
        trigger={<Button variant="ghost" size="sm"><RotateCw className="h-4 w-4" /><span className="hidden lg:inline">{t("users.newLink")}</span></Button>} />
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
