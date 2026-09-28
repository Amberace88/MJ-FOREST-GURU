"use client";

import { ClipboardList, Home, Menu, PlusCircle, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Mobile bottom navigation: Home · Work · Tasks · Report · More (spec §113). */
export function MobileNav() {
  const pathname = usePathname();
  const { t } = useT();
  const items = [
    { href: "/dashboard", label: t("nav.mobile.home"), Icon: Home },
    { href: "/work", label: t("nav.mobile.work"), Icon: Timer },
    { href: "/report", label: t("nav.mobile.report"), Icon: PlusCircle, primary: true },
    { href: "/tasks", label: t("nav.mobile.tasks"), Icon: ClipboardList },
    { href: "/more", label: t("nav.mobile.more"), Icon: Menu },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Mobilā navigācija">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, primary }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted")}>
                {primary ? (
                  <span className="-mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-amber text-[#1b1406] shadow-[0_8px_24px_-6px_#e2a23b] ring-4 ring-bg">
                    <Icon className="h-7 w-7" />
                  </span>
                ) : (
                  <Icon className={cn("h-6 w-6", active && "text-moss")} />
                )}
                <span className={cn(primary && "-mt-0.5")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
