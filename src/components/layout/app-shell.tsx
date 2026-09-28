"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { I18nProvider } from "@/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { CommandMenu, useCommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import type { NavGroup } from "./nav-config";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type ShellProps = {
  locale: string;
  userId: string;
  userName: string;
  roleLabel: string;
  orgName: string;
  orgId: string;
  orgs: { id: string; name: string; is_demo: boolean }[];
  isDemo: boolean;
  nav: NavGroup[];
  perms: string[];
  countries: { id: string; code: string; name: string; flag: string | null }[];
  countryId: string | null;
  showCountrySwitch: boolean;
  unread: number;
  children: ReactNode;
};

export function AppShell(props: ShellProps) {
  const { open, setOpen } = useCommandMenu();
  const router = useRouter();

  // Session expiry: redirect to login with a clear message. Offline queue stays in IndexedDB.
  useEffect(() => {
    const sb = getBrowserClient();
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login?expired=1");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // Register the service worker (static assets only — never caches company data)
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <I18nProvider locale={props.locale}>
      <div className="min-h-dvh">
        <Sidebar groups={props.nav} orgName={props.orgName} isDemo={props.isDemo} />
        <div className="lg:pl-[248px]">
          <Topbar userId={props.userId} userName={props.userName} roleLabel={props.roleLabel} countries={props.countries}
            countryId={props.countryId} showCountrySwitch={props.showCountrySwitch} unread={props.unread} onOpenSearch={() => setOpen(true)}
            orgs={props.orgs} orgId={props.orgId} />
          <main id="main" className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-7 animate-fade-in">{props.children}</main>
        </div>
        <MobileNav />
        <CommandMenu open={open} onClose={() => setOpen(false)} perms={props.perms} />
        <Toaster />
      </div>
    </I18nProvider>
  );
}
