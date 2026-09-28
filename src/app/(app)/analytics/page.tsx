import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeader, TabNav } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { fmtDate } from "@/lib/format";
import { searchParamsToString, sp as one } from "@/lib/utils";
import { resolvePeriod } from "./period";
import { PeriodFilter } from "./period-filter";
import { CountriesTab, FinanceTab, FleetTab, FuelTab, PeopleTab, ProjectsTab } from "./sections";

export const metadata: Metadata = { title: "Analītika" };

const TABS = ["people", "fleet", "fuel", "projects", "finance", "countries"] as const;
type Tab = (typeof TABS)[number];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("view_analytics");
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "people";
  const tz = ctx.settings?.default_timezone ?? ctx.timezone;
  const period = resolvePeriod({ period: one(sp.period), from: one(sp.from), to: one(sp.to) }, tz);
  const props = { ctx, period, tz, country: ctx.countryId ?? undefined };

  return (
    <>
      <PageHeader
        title={ctx.t("analytics.title")}
        subtitle={ctx.t("analytics.subtitle")}
        eyebrow={ctx.country ? <><span>{ctx.country.flag}</span><span>{ctx.country.name}</span></> : <span>{ctx.t("common.allCountries")}</span>}
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PeriodFilter period={period.key} from={period.from} to={period.to} />
        <p className="text-xs text-muted tabular">
          {fmtDate(period.from)} – {fmtDate(period.to)} · {ctx.t("analytics.days", { n: period.days })}
          <span className="text-faint"> · {ctx.t("analytics.previousPeriod")}: {fmtDate(period.prevFrom)} – {fmtDate(period.prevTo)}</span>
        </p>
      </div>
      <TabNav active={tab} items={TABS.map((k) => ({ key: k, label: ctx.t(`analytics.tabs.${k}`), href: `/analytics${searchParamsToString(sp, { tab: k === "people" ? null : k })}` }))} />

      {tab === "people" && <PeopleTab {...props} />}
      {tab === "fleet" && <FleetTab {...props} />}
      {tab === "fuel" && <FuelTab {...props} />}
      {tab === "projects" && <ProjectsTab {...props} />}
      {tab === "finance" && <FinanceTab {...props} />}
      {tab === "countries" && <CountriesTab {...props} />}

      <p className="mt-8 flex items-start gap-2 text-xs text-faint"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ctx.t("analytics.currencyNote")}</p>
    </>
  );
}
