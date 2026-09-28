"use client";

import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/(app)/shell-actions";
import { NAV_ICONS } from "@/components/layout/icons";
import type { NavGroup } from "@/components/layout/nav-config";
import { useT } from "@/i18n/client";

export function MoreList({ groups }: { groups: NavGroup[] }) {
  const { t } = useT();
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">{t(g.label)}</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {g.items.map((i) => {
              const Icon = NAV_ICONS[i.key] ?? ChevronRight;
              return (
                <li key={i.key}>
                  <Link href={i.href} className="flex min-h-14 items-center gap-3 px-4 text-sm hover:bg-surface-2/60">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-3 text-moss"><Icon className="h-4.5 w-4.5" /></span>
                    <span className="flex-1">{t(i.label)}</span>
                    <ChevronRight className="h-4 w-4 text-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <form action={logout}>
        <button type="submit" className="card flex min-h-14 w-full items-center gap-3 px-4 text-sm text-crit hover:bg-crit/10">
          <LogOut className="h-4 w-4" /> {t("auth.logout")}
        </button>
      </form>
    </div>
  );
}
