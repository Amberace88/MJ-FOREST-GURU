"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./icons";
import type { NavGroup } from "./nav-config";

export function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ groups, orgName, isDemo }: { groups: NavGroup[]; orgName: string; isDemo: boolean }) {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <aside className="topo-bg fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-[linear-gradient(180deg,var(--sidebar-top),var(--bg))] lg:flex">
      <div className="flex h-[68px] items-center border-b border-line px-4">
        <Link href="/dashboard" className="min-w-0" aria-label={t("brand.name")} title={orgName}>
          <Logo subtitle={t("brand.tagline")} />
        </Link>
      </div>
      {isDemo && (
        <div className="mx-3 mt-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-1.5 text-center text-[11px] font-semibold tracking-[0.2em] text-amber">
          DEMO DATI
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Galvenā navigācija">
        {groups.map((g) => (
          <div key={g.key} className="mb-4">
            <div className="mb-1.5 px-2 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-faint">{t(g.label)}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = NAV_ICONS[it.key] ?? NAV_ICONS.dashboard;
                const active = isActive(pathname, it.href);
                return (
                  <li key={it.key}>
                    <Link href={it.href} aria-current={active ? "page" : undefined}
                      className={cn("group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                        active ? "bg-forest-800/70 text-ink" : "text-ink-2/80 hover:bg-surface-2 hover:text-ink")}>
                      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-amber" />}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-moss" : "text-muted group-hover:text-ink-2")} />
                      <span className="truncate">{t(it.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-faint">{t("brand.footer")}</div>
    </aside>
  );
}
