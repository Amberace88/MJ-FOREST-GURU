"use client";

import { Coins, Receipt, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Donut } from "@/components/charts";
import { useT } from "@/i18n/client";
import { currencySymbol, jobProfitability, parseNum, THIN_MARGIN_PCT, type JobInput } from "@/lib/calc";
import { fmtMoney, fmtNumber } from "@/lib/format";
import type { CalcProps, ProfitState } from "./state";
import { CalcCard, CalcLayout, CHART_COLORS, Hero, MarginMeter, moneyDigits, NumField, ResultCard, ResultRow, VerdictBadge } from "./ui";

type CostKey = "harvester" | "forwarder" | "fuel" | "transport" | "labour" | "other";
const COST_KEYS: CostKey[] = ["harvester", "forwarder", "fuel", "transport", "labour", "other"];

export function ProfitCalc({ s, set, reset, currency, prefill, pre }: CalcProps<"profit">) {
  const { t } = useT();
  const sym = currencySymbol(currency);
  const d = moneyDigits(currency);
  const h = t("calculators.units.h");

  const input = useMemo(() => {
    const out = {} as JobInput;
    for (const k of Object.keys(s) as (keyof ProfitState)[]) out[k] = parseNum(s[k]);
    return out;
  }, [s]);
  const r = useMemo(() => jobProfitability(input), [input]);
  const tone = r.verdict === "profit" ? "ok" : r.verdict === "thin" ? "warn" : r.verdict === "loss" ? "crit" : "forest";

  const labels: Record<CostKey, string> = {
    harvester: t("calculators.profit.harvester"), forwarder: t("calculators.profit.forwarder"), fuel: t("calculators.profit.fuel"),
    transport: t("calculators.profit.transport"), labour: t("calculators.profit.labour"), other: t("calculators.profit.other"),
  };
  const donut = COST_KEYS.map((k) => ({ key: k, name: labels[k], value: Math.round(r.costs[k] * 100) / 100 }))
    .filter((x) => x.value > 0)
    .map((x, i) => ({ ...x, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const pair = (key: CostKey, a: { k: keyof ProfitState; label: string; unit: string; pre?: boolean }, b: { k: keyof ProfitState; label: string; unit: string; pre?: boolean }) => (
    <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
      <NumField label={`${labels[key]} · ${a.label}`}
        value={s[a.k]} onChange={(v) => set({ [a.k]: v } as Partial<ProfitState>)} unit={a.unit} prefilled={a.pre} />
      <NumField label={b.label} value={s[b.k]} onChange={(v) => set({ [b.k]: v } as Partial<ProfitState>)} unit={b.unit} prefilled={b.pre} />
      <div className="col-span-2 -mt-1 text-right text-sm font-medium tabular text-ink-2 sm:col-span-1 sm:mt-0 sm:pb-2.5">
        = {fmtMoney(r.costs[key], currency)}
      </div>
    </div>
  );

  return (
    <CalcLayout
      inputs={<>
        <CalcCard title={t("calculators.profit.revenueSection")} icon={Coins} onReset={reset}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label={t("calculators.profit.volume")} value={s.volume} onChange={(v) => set({ volume: v })} unit={t("calculators.units.m3")} />
            <NumField label={t("calculators.profit.price")} value={s.price} onChange={(v) => set({ price: v })} unit={`${sym}${t("calculators.units.perM3")}`} />
          </div>
          <p className="mt-3 text-right text-sm text-muted">{t("calculators.profit.revenue")}: <span className="font-semibold tabular text-ink">{fmtMoney(r.revenue, currency)}</span></p>
        </CalcCard>

        <CalcCard title={t("calculators.profit.costSection")} icon={Receipt}>
          <div className="space-y-4">
            {pair("harvester", { k: "harvesterHours", label: t("calculators.profit.hours"), unit: h }, { k: "harvesterRate", label: t("calculators.profit.rate"), unit: `${sym}/${h}` })}
            {pair("forwarder", { k: "forwarderHours", label: t("calculators.profit.hours"), unit: h }, { k: "forwarderRate", label: t("calculators.profit.rate"), unit: `${sym}/${h}` })}
            <p className="-mt-2 text-[11px] text-faint">{t("calculators.profit.machineRateHint")}</p>
            {pair("fuel", { k: "fuelLitres", label: t("calculators.profit.litres"), unit: t("calculators.units.l") },
              { k: "fuelPrice", label: t("calculators.profit.fuelPrice"), unit: `${sym}${t("calculators.units.perL")}`, pre: pre(s.fuelPrice, prefill.fuelPrice) })}
            {pair("labour", { k: "labourHours", label: t("calculators.profit.hours"), unit: h },
              { k: "labourRate", label: t("calculators.profit.rate"), unit: `${sym}/${h}`, pre: pre(s.labourRate, prefill.hourlyRate) })}
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
              <NumField label={labels.transport}
                value={s.transportPerM3} onChange={(v) => set({ transportPerM3: v })} unit={`${sym}${t("calculators.units.perM3")}`} />
              <NumField label={labels.other}
                value={s.other} onChange={(v) => set({ other: v })} unit={sym} />
              <div className="col-span-2 -mt-1 text-right text-sm font-medium tabular text-ink-2 sm:col-span-1 sm:mt-0 sm:pb-2.5">
                = {fmtMoney(r.costs.transport + r.costs.other, currency)}
              </div>
            </div>
            <div className="border-t border-line pt-4 sm:w-1/2">
              <NumField label={t("calculators.profit.targetMargin")} value={s.targetMarginPct} onChange={(v) => set({ targetMarginPct: v })} unit={t("calculators.units.pct")} />
            </div>
          </div>
        </CalcCard>
      </>}
      results={<>
        <ResultCard tone={tone}>
          <div className="flex items-start justify-between gap-3">
            <Hero label={t("calculators.profit.profit")} value={input.volume > 0 || r.revenue > 0 ? r.profit : null} decimals={d} unit={sym}
              tone={r.verdict === "loss" ? "crit" : r.verdict === "thin" ? "warn" : r.verdict === "profit" ? "ok" : "ink"} />
            <VerdictBadge verdict={r.verdict} />
          </div>
          <p className="mt-2 text-sm text-muted">{t(`calculators.verdictText.${r.verdict}`, { pct: THIN_MARGIN_PCT })}</p>
          <div className="mt-4"><MarginMeter marginPct={r.marginPct} thinPct={THIN_MARGIN_PCT} /></div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
            <Hero label={t("calculators.profit.margin")} value={r.marginPct} decimals={1} unit="%" />
            <Hero label={t("calculators.profit.costPerM3")} value={r.costPerM3} decimals={2} unit={`${sym}${t("calculators.units.perM3")}`} />
          </div>
          <div className="mt-4 divide-y divide-line/60">
            <ResultRow label={t("calculators.profit.revenue")} value={r.revenue} decimals={d} unit={sym} />
            <ResultRow label={t("calculators.profit.totalCost")} value={r.totalCost} decimals={d} unit={sym} />
            <ResultRow label={t("calculators.profit.breakEven")} value={r.breakEvenPrice} decimals={2} unit={`${sym}${t("calculators.units.perM3")}`} tone="warn" />
            <ResultRow label={t("calculators.profit.targetPrice", { pct: fmtNumber(input.targetMarginPct, 0) })} value={r.targetPrice} decimals={2} unit={`${sym}${t("calculators.units.perM3")}`} tone="ok" />
          </div>
        </ResultCard>

        {donut.length > 0 && (
          <CalcCard title={t("calculators.profit.structure")} icon={TrendingUp}>
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <Donut data={donut.map(({ name, value }) => ({ name, value }))} unit={sym} height={190} />
              <div className="divide-y divide-line/50">
                {donut.map((x) => (
                  <ResultRow key={x.key} dot={x.color} label={<>{x.name} <span className="text-faint">· {fmtNumber(r.totalCost > 0 ? (x.value / r.totalCost) * 100 : 0, 0)}%</span></>}
                    value={x.value} decimals={d} unit={sym} />
                ))}
              </div>
            </div>
          </CalcCard>
        )}
      </>}
    />
  );
}
