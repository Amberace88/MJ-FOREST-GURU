"use client";

import { useRouter } from "next/navigation";
import { GlobalInviteLinkDialog } from "@/components/shared/invite-link-dialog";
import { useEffect, type ReactNode } from "react";
import { CompaniesProvider } from "@/components/shared/company";
import { Toaster } from "@/components/ui/toast";
import { I18nProvider, useT } from "@/i18n/client";
import type { CompanyLite } from "@/lib/companies";
import { isStaleDeployError, reloadOnceForNewDeploy } from "@/lib/stale-deploy";
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
  /** signed in via e-mail link (invite / recovery) — password not confirmed in this session */
  needsPassword?: boolean;
  isDemo: boolean;
  nav: NavGroup[];
  perms: string[];
  countries: { id: string; code: string; name: string; flag: string | null }[];
  countryId: string | null;
  showCountrySwitch: boolean;
  /** legal companies (non-deleted, inactive included) + global company filter */
  companies: CompanyLite[];
  companyId: string | null;
  showCompanySwitch: boolean;
  unread: number;
  children: ReactNode;
};

export function AppShell(props: ShellProps) {
  const { open, setOpen } = useCommandMenu();
  const router = useRouter();

  // New deployment while this tab was open: reload once instead of failing actions.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => { if (isStaleDeployError(e.reason)) reloadOnceForNewDeploy(); };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

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
      <CompaniesProvider companies={props.companies} companyId={props.companyId}>
        <div className="min-h-dvh">
          <Sidebar groups={props.nav} orgName={props.orgName} isDemo={props.isDemo} />
          <div className="lg:pl-[248px]">
            <Topbar userId={props.userId} userName={props.userName} roleLabel={props.roleLabel} countries={props.countries}
              countryId={props.countryId} showCountrySwitch={props.showCountrySwitch} unread={props.unread} onOpenSearch={() => setOpen(true)}
              orgs={props.orgs} orgId={props.orgId}
              companies={props.showCompanySwitch ? props.companies.filter((c) => c.is_active) : []} companyId={props.companyId} />
            {props.needsPassword && (
              <div role="status" className="border-b border-amber/30 bg-amber/10 px-4 py-2.5 text-center text-sm text-amber lg:px-8">
                <PasswordBanner />
              </div>
            )}
            <main id="main" className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-7 animate-fade-in">{props.children}</main>
          </div>
          <MobileNav />
          <CommandMenu open={open} onClose={() => setOpen(false)} perms={props.perms} />
          <Toaster />
          <GlobalInviteLinkDialog />
        </div>
      </CompaniesProvider>
    </I18nProvider>
  );
}

function PasswordBanner() {
  const { t } = useT();
  return (
    <>
      {t("auth.setPasswordBanner")}{" "}
      <a href="/reset-password?welcome=1" className="font-semibold underline underline-offset-4 hover:text-ink">{t("auth.setPassword")} →</a>
    </>
  );
}
