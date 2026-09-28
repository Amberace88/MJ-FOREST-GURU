"use client";

import { Bell, Building2, Check, CloudOff, LogOut, RefreshCw, Search, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getNotifications, logout, markNotificationsRead, setCountryFilter, setOrganization } from "@/app/(app)/shell-actions";
import { Logo } from "@/components/brand/logo";
import { Avatar, Kbd } from "@/components/ui/misc";
import { useT } from "@/i18n/client";
import { fmtRelative } from "@/lib/format";
import { useSyncQueue } from "@/lib/offline/use-sync";
import { cn } from "@/lib/utils";

type Country = { id: string; code: string; name: string; flag: string | null };
type Notif = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; type: string };

export type OrgOption = { id: string; name: string; is_demo: boolean };

export function Topbar({ userId, userName, roleLabel, countries, countryId, showCountrySwitch, unread, onOpenSearch, orgs = [], orgId }: {
  userId: string; userName: string; roleLabel: string; countries: Country[]; countryId: string | null;
  showCountrySwitch: boolean; unread: number; onOpenSearch: () => void; orgs?: OrgOption[]; orgId?: string;
}) {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:h-[68px] lg:px-6">
      <Link href="/dashboard" className="lg:hidden" aria-label={t("brand.name")}><Logo compact /></Link>
      <div className="hidden min-w-0 flex-1 lg:block">
        {showCountrySwitch && <CountrySwitch countries={countries} countryId={countryId} />}
      </div>
      <div className="flex-1 lg:hidden">
        {showCountrySwitch && <CountrySwitch countries={countries} countryId={countryId} compact />}
      </div>
      <button onClick={onOpenSearch}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-faint transition hover:border-line-strong hover:text-muted md:flex">
        <Search className="h-4 w-4" /> <span className="flex-1 text-left">{t("common.search")}…</span> <Kbd>⌘K</Kbd>
      </button>
      <button onClick={onOpenSearch} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 md:hidden" aria-label={t("common.search")}>
        <Search className="h-5 w-5" />
      </button>
      <SyncIndicator userId={userId} />
      <NotificationsBell unread={unread} />
      <UserMenu name={userName} roleLabel={roleLabel} orgs={orgs} orgId={orgId} />
    </header>
  );
}

function CountrySwitch({ countries, countryId, compact }: { countries: Country[]; countryId: string | null; compact?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(countryId);
  const choose = (id: string | null) => {
    setCurrent(id);
    start(async () => { await setCountryFilter(id); router.refresh(); });
  };
  const items = [{ id: null as string | null, label: compact ? t("common.all") : t("common.allCountries"), flag: "🌍" }, ...countries.map((c) => ({ id: c.id as string | null, label: compact ? c.code : c.name.toUpperCase(), flag: c.flag ?? "" }))];
  return (
    <div role="radiogroup" aria-label={t("common.country")} className={cn("inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5", pending && "opacity-70")}>
      {items.map((it) => (
        <button key={it.id ?? "all"} role="radio" aria-checked={current === it.id} onClick={() => choose(it.id)}
          className={cn("flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold tracking-wide transition",
            current === it.id ? "bg-forest-700 text-ink shadow-inner" : "text-muted hover:text-ink")}>
          <span aria-hidden>{it.flag}</span><span className={cn(compact && "hidden sm:inline")}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function SyncIndicator({ userId }: { userId: string }) {
  const { t } = useT();
  const { pending, online, syncing, sync } = useSyncQueue(userId);
  if (online && pending.length === 0 && !syncing) return null;
  return (
    <button onClick={() => sync()} title={online ? t("work.offlineQueued") : t("work.offline")}
      className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
        online ? "border-warn/30 bg-warn/10 text-warn" : "border-crit/30 bg-crit/10 text-crit")}>
      {!online ? <CloudOff className="h-4 w-4" /> : syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">{online ? t("work.offlineQueued") : t("work.offline").split("—")[0]}</span>
      {pending.length > 0 && <span className="tabular">{pending.length}</span>}
    </button>
  );
}

function NotificationsBell({ unread }: { unread: number }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [count, setCount] = useState(unread);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => setCount(unread), [unread]);
  useEffect(() => {
    if (!open) return;
    getNotifications().then((d) => setItems(d as Notif[]));
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("notifications.title")} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {count > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-1 text-[10px] font-bold text-[#1b1406]">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-sm font-semibold uppercase tracking-wider">{t("notifications.title")}</span>
            <button className="flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={async () => { await markNotificationsRead(); setCount(0); setItems((x) => x?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null); router.refresh(); }}>
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAllRead")}
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items === null && <li className="p-4"><div className="skeleton h-10" /></li>}
            {items?.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">{t("notifications.empty")}</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/notifications"} onClick={() => { setOpen(false); if (!n.read_at) markNotificationsRead([n.id]); }}
                  className="flex gap-3 border-b border-line/60 px-4 py-3 hover:bg-surface-2">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-amber")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-faint">{fmtRelative(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs text-muted hover:text-ink">{t("common.viewAll")}</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, roleLabel, orgs, orgId }: { name: string; roleLabel: string; orgs: OrgOption[]; orgId?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2" aria-expanded={open} aria-label={name}>
        <Avatar name={name} size={32} />
        <span className="hidden text-left leading-tight xl:block">
          <span className="block max-w-[140px] truncate text-sm font-medium text-ink">{name}</span>
          <span className="block text-[11px] text-muted">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-line-strong bg-surface py-1 shadow-2xl animate-fade-up">
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-xs text-muted">{roleLabel}</div>
          </div>
          {orgs.length > 1 && (
            <div className="border-b border-line py-1">
              <div className="px-4 pb-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-faint">{t("common.organization")}</div>
              {orgs.map((o) => (
                <button key={o.id} type="button" disabled={switching}
                  onClick={() => startSwitch(async () => { await setOrganization(o.id); setOpen(false); router.push("/dashboard"); router.refresh(); })}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <Building2 className="h-4 w-4 shrink-0 text-moss" />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.is_demo && <span className="rounded bg-amber/20 px-1 text-[9px] font-bold text-amber">DEMO</span>}
                  {o.id === orgId && <Check className="h-4 w-4 shrink-0 text-amber" />}
                </button>
              ))}
            </div>
          )}
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <LogOut className="h-4 w-4" /> {t("auth.logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
