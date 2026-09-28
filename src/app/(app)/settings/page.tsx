import type { Metadata } from "next";
import { Bell, Building2, ChevronRight, Clock3, Globe2, HardHat, ListChecks, Plug, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import type { Permission } from "@/lib/permissions";
import { cn, sp as one } from "@/lib/utils";
import {
  AlertRulesForm, CompanyForm, CountryDialog, CountryToggle, LookupDialog, LookupToggle, WorkRulesForm,
  type CountryRow, type LookupRow,
} from "./components";
import { LOOKUP_KINDS, SETTINGS_TABS, type LookupKind, type SettingsTab } from "./constants";

export const metadata: Metadata = { title: "Iestatījumi" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission("manage_settings");
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: SettingsTab = (SETTINGS_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as SettingsTab) : "general";
  const kindParam = one(sp.kind);
  const kind: LookupKind = (LOOKUP_KINDS as readonly string[]).includes(kindParam ?? "") ? (kindParam as LookupKind) : "work_type";

  const { data: settings } = await ctx.supabase.from("organization_settings").select("*").eq("organization_id", ctx.org.id).maybeSingle();

  const tabs = SETTINGS_TABS.map((k) => ({ key: k, label: ctx.t(`settings.tabs.${k}`), href: `/settings?tab=${k}` }));

  let content: ReactNode = null;
  if (tab === "general") {
    const links: { href: string; icon: ReactNode; title: string; text: string; perms: Permission[] }[] = [
      { href: "/settings/users", icon: <Users className="h-4 w-4" />, title: ctx.t("nav.users"), text: ctx.t("settings.moreLinks.users"), perms: ["manage_users", "manage_permissions"] },
      { href: "/settings/integrations", icon: <Plug className="h-4 w-4" />, title: ctx.t("nav.integrations"), text: ctx.t("settings.moreLinks.integrations"), perms: ["manage_integrations"] },
      { href: "/teams", icon: <HardHat className="h-4 w-4" />, title: ctx.t("nav.teams"), text: ctx.t("settings.moreLinks.teams"), perms: ["manage_teams", "view_team", "view_all_employees"] },
      { href: "/safety", icon: <ShieldCheck className="h-4 w-4" />, title: ctx.t("nav.safety"), text: ctx.t("settings.moreLinks.safety"), perms: ["manage_safety"] },
      { href: "/audit", icon: <ScrollText className="h-4 w-4" />, title: ctx.t("nav.audit"), text: ctx.t("settings.moreLinks.audit"), perms: ["view_audit_log"] },
    ];
    content = (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="animate-fade-up">
          <CardHeader icon={<Building2 className="h-4 w-4" />} title={ctx.t("settings.sections.company")} subtitle={ctx.t("settings.companyHint")} />
          <CardBody>
            <CompanyForm values={{
              name: ctx.org.name, legal_name: settings?.legal_name ?? null, registration_number: settings?.registration_number ?? null,
              default_language: settings?.default_language ?? "lv", default_timezone: settings?.default_timezone ?? "Europe/Riga",
              default_currency: settings?.default_currency ?? "EUR",
            }} />
          </CardBody>
        </Card>
        <Card className="animate-fade-up h-fit" >
          <CardHeader title={ctx.t("settings.more")} />
          <CardBody className="space-y-2">
            {links.filter((l) => ctx.canAny(...l.perms)).map((l) => (
              <Link key={l.href} href={l.href} className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-3 transition-colors hover:border-line-strong hover:bg-surface-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss">{l.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{l.title}</span>
                  <span className="block truncate text-xs text-muted">{l.text}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-amber" />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    );
  } else if (tab === "rules") {
    content = (
      <Card className="max-w-3xl animate-fade-up">
        <CardHeader icon={<Clock3 className="h-4 w-4" />} title={ctx.t("settings.workRules")} subtitle={ctx.t("settings.workRulesHint")} />
        <CardBody>
          <WorkRulesForm values={{
            overtime_after_hours: Number(settings?.overtime_after_hours ?? 8), max_shift_hours: Number(settings?.max_shift_hours ?? 12),
            missing_checkout_after_hours: Number(settings?.missing_checkout_after_hours ?? 13), service_warning_hours: Number(settings?.service_warning_hours ?? 50),
          }} />
        </CardBody>
      </Card>
    );
  } else if (tab === "countries") {
    const { data } = await ctx.supabase.from("countries")
      .select("id, code, name, flag, timezone, currency, sort_order, is_active, site_identifier_fields")
      .eq("organization_id", ctx.org.id).order("sort_order").order("code");
    const rows: CountryRow[] = (data ?? []).map((c) => ({
      ...c, site_identifier_fields: Array.isArray(c.site_identifier_fields) ? (c.site_identifier_fields as string[]) : [],
    }));
    content = (
      <section className="animate-fade-up">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted">{ctx.t("settings.countries.hint")}</p>
          <CountryDialog />
        </div>
        <DataTable rows={rows} rowKey={(r) => r.id}
          empty={<EmptyState icon={<Globe2 className="h-6 w-6" />} title={ctx.t("common.noData")} />}
          columns={[
            { key: "name", header: ctx.t("settings.countries.name"), cell: (r) => (
              <span className={cn("flex items-center gap-2.5", !r.is_active && "opacity-60")}>
                <span className="text-lg" aria-hidden>{r.flag}</span>
                <span className="font-medium text-ink">{r.name}</span>
                <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{r.code}</span>
              </span>
            ) },
            { key: "tz", header: ctx.t("settings.countries.timezone"), cell: (r) => <span className="text-ink-2">{r.timezone}</span> },
            { key: "cur", header: ctx.t("settings.countries.currency"), cell: (r) => <span className="tabular text-ink-2">{r.currency}</span> },
            { key: "ids", header: ctx.t("settings.countries.identifierFields"), hideOnMobile: true, cell: (r) => (
              <span className="flex flex-wrap gap-1">
                {r.site_identifier_fields.length === 0 ? <span className="text-faint">—</span>
                  : r.site_identifier_fields.map((f) => <Badge key={f} tone="neutral">{ctx.label("projects.identifierFields", f)}</Badge>)}
              </span>
            ) },
            { key: "status", header: ctx.t("common.status"), cell: (r) => (
              <Badge tone={r.is_active ? "ok" : "off"} dot>{r.is_active ? ctx.t("settings.countries.active") : ctx.t("settings.countries.inactive")}</Badge>
            ) },
            { key: "actions", header: <span className="sr-only">{ctx.t("common.actions")}</span>, align: "right", cell: (r) => (
              <span className="inline-flex items-center gap-1"><CountryDialog country={r} /><CountryToggle id={r.id} active={r.is_active} /></span>
            ) },
          ]} />
      </section>
    );
  } else if (tab === "lookups") {
    const { data } = await ctx.supabase.from("lookup_values").select("id, key, label, sort_order, is_active")
      .eq("organization_id", ctx.org.id).eq("kind", kind).order("sort_order").order("label");
    const rows: LookupRow[] = data ?? [];
    content = (
      <section className="animate-fade-up">
        <p className="mb-4 max-w-3xl text-sm text-muted">{ctx.t("settings.lookups.hint")}</p>
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label={ctx.t("settings.lookups.title")} className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {LOOKUP_KINDS.map((k) => (
              <Link key={k} href={`/settings?tab=lookups&kind=${k}`} scroll={false} aria-current={k === kind ? "page" : undefined}
                className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                  k === kind ? "bg-surface-2 text-ink ring-1 ring-line-strong" : "text-muted hover:bg-surface-2/60 hover:text-ink")}>
                {ctx.label("settings.lookups.kinds", k)}
              </Link>
            ))}
          </nav>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{ctx.label("settings.lookups.kinds", kind)}</h2>
              <LookupDialog kind={kind} />
            </div>
            <DataTable rows={rows} rowKey={(r) => r.id}
              empty={<EmptyState icon={<ListChecks className="h-6 w-6" />} title={ctx.t("settings.lookups.empty")} action={<LookupDialog kind={kind} />} />}
              columns={[
                { key: "label", header: ctx.t("settings.label"), cell: (r) => <span className={cn("font-medium text-ink", !r.is_active && "text-muted line-through decoration-faint")}>{r.label}</span> },
                { key: "key", header: ctx.t("settings.key"), cell: (r) => <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-2">{r.key}</code> },
                { key: "order", header: ctx.t("settings.lookups.sortOrder"), align: "right", hideOnMobile: true, cell: (r) => r.sort_order },
                { key: "status", header: ctx.t("common.status"), cell: (r) => (
                  <Badge tone={r.is_active ? "ok" : "off"} dot>{r.is_active ? ctx.t("settings.lookups.active") : ctx.t("settings.lookups.inactive")}</Badge>
                ) },
                { key: "actions", header: <span className="sr-only">{ctx.t("common.actions")}</span>, align: "right", cell: (r) => (
                  <span className="inline-flex items-center gap-1"><LookupDialog kind={kind} value={r} /><LookupToggle id={r.id} active={r.is_active} /></span>
                ) },
              ]} />
          </div>
        </div>
      </section>
    );
  } else {
    const raw = settings?.alert_config;
    const config: Record<string, boolean> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) config[k] = v !== false && v !== "false";
    }
    content = (
      <Card className="max-w-4xl animate-fade-up">
        <CardHeader icon={<Bell className="h-4 w-4" />} title={ctx.t("settings.alerts.title")} subtitle={ctx.t("settings.alertToggles")} />
        <CardBody><AlertRulesForm config={config} /></CardBody>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title={ctx.t("settings.title")} subtitle={ctx.t("settings.subtitle")} eyebrow={ctx.org.name} />
      <TabNav items={tabs} active={tab} />
      {content}
    </>
  );
}
