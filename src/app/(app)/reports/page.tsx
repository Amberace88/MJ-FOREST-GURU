import type { Metadata } from "next";
import {
  CalendarRange, Clock, FileBarChart, FileSpreadsheet, FileText, Fuel, HardHat, Lock, Siren, TreePine, Tractor, Trees, Wallet, Wrench,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { fmtDate } from "@/lib/format";
import { cn, sp as one } from "@/lib/utils";
import { resolvePeriod } from "../analytics/period";
import { PeriodFilter } from "../analytics/period-filter";
import { exportHref, PERIODLESS, REPORT_PERMS, REPORT_TYPES, type ReportType } from "./config";

export const metadata: Metadata = { title: "Atskaites" };

const ICONS: Record<ReportType, ReactNode> = {
  hours: <Clock className="h-5 w-5" />, fuel: <Fuel className="h-5 w-5" />, expenses: <Wallet className="h-5 w-5" />,
  machines: <Tractor className="h-5 w-5" />, maintenance: <Wrench className="h-5 w-5" />, projects: <TreePine className="h-5 w-5" />,
  production: <Trees className="h-5 w-5" />, safety: <HardHat className="h-5 w-5" />, incidents: <Siren className="h-5 w-5" />,
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("export_reports");
  const sp = await searchParams;
  const tz = ctx.settings?.default_timezone ?? ctx.timezone;
  const period = resolvePeriod({ period: one(sp.period), from: one(sp.from), to: one(sp.to) }, tz);
  const countryParam = one(sp.country);
  const country = countryParam && ctx.countries.some((c) => c.id === countryParam) ? countryParam : ctx.countryId;

  return (
    <>
      <PageHeader title={ctx.t("reports.title")} subtitle={ctx.t("reports.subtitle")} />

      <Link href="/reports/monthly" className="card card-hover topo-bg mb-6 flex items-center gap-4 overflow-hidden p-5 animate-fade-up">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber"><FileBarChart className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-bold uppercase tracking-wide">{ctx.t("reports.monthly")}</span>
          <span className="block text-sm text-muted">{ctx.t("reports.monthlySubtitle")}</span>
        </span>
        <span className={buttonClass("amber", "md", "hidden sm:inline-flex")}>{ctx.t("reports.monthlyOpen")}</span>
      </Link>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PeriodFilter period={period.key} from={period.from} to={period.to} />
        {ctx.countries.length > 1 && (
          <FilterBar className="mb-0" filters={[{ type: "select", name: "country", label: ctx.t("common.country"),
            options: ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() })) }]} />
        )}
      </div>
      <p className="mb-5 flex items-center gap-2 text-xs text-muted tabular">
        <CalendarRange className="h-4 w-4" /> {ctx.t("reports.period")}: {fmtDate(period.from)} – {fmtDate(period.to)}
        {" · "}{country ? ctx.countries.find((c) => c.id === country)?.name : ctx.t("reports.countryAll")}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {REPORT_TYPES.map((type, i) => {
          const allowed = ctx.canAny(...REPORT_PERMS[type]);
          const params = { from: period.from, to: period.to, country };
          return (
            <li key={type} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 9) * 35}ms` }}>
              <Card className={cn("flex h-full flex-col p-5", !allowed && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-moss">{ICONS[type]}</span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{ctx.label("reports.types", type)}</h2>
                    <p className="mt-0.5 text-sm text-muted">{ctx.label("reports.descriptions", type)}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  {allowed ? (
                    <>
                      <a href={exportHref(type, { ...params, format: "csv" })} download className={buttonClass("secondary", "sm")}>
                        <FileText className="h-4 w-4" /> {ctx.t("reports.csv")}
                      </a>
                      <a href={exportHref(type, { ...params, format: "excel" })} download className={buttonClass("primary", "sm")}>
                        <FileSpreadsheet className="h-4 w-4" /> {ctx.t("reports.excel")}
                      </a>
                      {PERIODLESS.includes(type) && <span className="text-[11px] text-faint">{ctx.t("common.today")}</span>}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" /> {ctx.t("reports.noPermission")}</span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-faint">{ctx.t("reports.formatsHint")}</p>
      <p className="mt-1 text-xs text-faint">{ctx.t("analytics.currencyNote")}</p>
    </>
  );
}
