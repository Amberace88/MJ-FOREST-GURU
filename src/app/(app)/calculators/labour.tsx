"use client";

import { Clock, PieChart, Users } from "lucide-react";
import { useMemo } from "react";
import { Donut } from "@/components/charts";
import { useT } from "@/i18n/client";
import { currencySymbol, labourCost, parseNum, SOCIAL_TAX_PRESETS, type SocialTaxCountry } from "@/lib/calc";
import { fmtNumber } from "@/lib/format";
import { toInput, type CalcProps, type LabourState } from "./state";
import { CalcCard, CalcLayout, CHART_COLORS, Hero, moneyDigits, NumField, ResultCard, ResultRow, Segmented } from "./ui";

export function LabourCalc({ s, set, reset, currency, prefill, pre }: CalcProps<"labour">) {
  const { t } = useT();
  const sym = currencySymbol(currency);
  const d = moneyDigits(currency);
  const perH = `${sym}/${t("calculators.units.h")}`;

  const r = useMemo(() => labourCost({
    hours: parseNum(s.hours), rate: parseNum(s.rate), overtimeHours: parseNum(s.overtimeHours),
    overtimeMultiplier: parseNum(s.overtimeMultiplier), socialTaxPct: parseNum(s.socialTaxPct),
  }), [s]);
  const f = (k: keyof LabourState) => ({ value: String(s[k]), onChange: (v: string) => set({ [k]: v } as Partial<LabourState>) });

  const presets: { value: SocialTaxCountry | "custom"; label: string }[] = [
    { value: "LV", label: `${t("calculators.labour.presetLV")} ${fmtNumber(SOCIAL_TAX_PRESETS.LV, 2)}%` },
    { value: "SE", label: `${t("calculators.labour.presetSE")} ${fmtNumber(SOCIAL_TAX_PRESETS.SE, 2)}%` },
    { value: "IS", label: `${t("calculators.labour.presetIS")} ${fmtNumber(SOCIAL_TAX_PRESETS.IS, 2)}%` },
  ];
  const pick = (c: SocialTaxCountry | "custom") => {
    if (c === "custom") return set({ country: c });
    set({ country: c, socialTaxPct: toInput(SOCIAL_TAX_PRESETS[c], 2) });
  };

  const donut = [
    { name: t("calculators.labour.base"), value: Math.round(r.base * 100) / 100 },
    { name: t("calculators.labour.overtimePay"), value: Math.round(r.overtime * 100) / 100 },
    { name: t("calculators.labour.tax"), value: Math.round(r.tax * 100) / 100 },
  ];
  const shown = donut.filter((x) => x.value > 0);
  const dot = (i: number) => { const j = shown.indexOf(donut[i]); return j >= 0 ? CHART_COLORS[j] : undefined; };

  return (
    <CalcLayout
      inputs={<>
        <CalcCard title={t("calculators.tabs.labour")} icon={Clock} onReset={reset}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label={t("calculators.labour.hours")} unit={t("calculators.units.h")} {...f("hours")} />
            <NumField label={t("calculators.labour.rate")} unit={perH} {...f("rate")} prefilled={pre(s.rate, prefill.hourlyRate)} />
            <NumField label={t("calculators.labour.overtime")} unit={t("calculators.units.h")} {...f("overtimeHours")} />
            <NumField label={t("calculators.labour.multiplier")} unit={t("calculators.units.times")} {...f("overtimeMultiplier")} />
          </div>
        </CalcCard>
        <CalcCard title={t("calculators.labour.socialTax")} icon={Users}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{t("calculators.labour.presets")}</div>
          <Segmented className="mt-1.5 w-full sm:w-auto" size="sm" options={presets}
            value={s.country === "custom" ? ("custom" as const) : s.country} onChange={pick} ariaLabel={t("calculators.labour.presets")} />
          <div className="mt-3 sm:w-1/2">
            <NumField label={t("calculators.labour.socialTax")} unit={t("calculators.units.pct")} value={s.socialTaxPct}
              onChange={(v) => set({ socialTaxPct: v, country: "custom" })}
              hint={s.country === "IS" ? t("calculators.labour.isHint") : undefined} />
          </div>
        </CalcCard>
      </>}
      results={<>
        <ResultCard tone="forest">
          <div className="grid grid-cols-2 gap-4">
            <Hero label={t("calculators.labour.employerCost")} value={r.employerCost} decimals={d} unit={sym} tone="amber" />
            <Hero label={t("calculators.labour.costPerHour")} value={r.costPerHour} decimals={2} unit={perH} />
          </div>
          <div className="mt-4 divide-y divide-line/60">
            <ResultRow dot={dot(0)} label={t("calculators.labour.base")} value={r.base} decimals={d} unit={sym} />
            <ResultRow dot={dot(1)} label={t("calculators.labour.overtimePay")} value={r.overtime} decimals={d} unit={sym} />
            <ResultRow label={t("calculators.labour.gross")} value={r.gross} decimals={d} unit={sym} strong />
            <ResultRow dot={dot(2)} label={`${t("calculators.labour.tax")} · ${fmtNumber(parseNum(s.socialTaxPct), 2)}%`} value={r.tax} decimals={d} unit={sym} />
            <ResultRow label={t("calculators.labour.employerCost")} value={r.employerCost} decimals={d} unit={sym} strong />
          </div>
        </ResultCard>
        {shown.length > 1 && (
          <CalcCard title={t("calculators.labour.employerCost")} icon={PieChart}>
            <Donut data={shown} unit={sym} height={190} />
          </CalcCard>
        )}
      </>}
    />
  );
}
