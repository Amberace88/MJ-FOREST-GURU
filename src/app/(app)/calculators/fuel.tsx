"use client";

import { CalendarRange, Clock, Fuel, Layers } from "lucide-react";
import { useMemo } from "react";
import { Bars } from "@/components/charts";
import { useT } from "@/i18n/client";
import { currencySymbol, fuelCost, parseNum, type FuelInput } from "@/lib/calc";
import { fmtNumber } from "@/lib/format";
import { MachineLphSelect } from "./machine";
import { toInput, type CalcProps, type FuelState } from "./state";
import { CalcCard, CalcLayout, Hero, moneyDigits, NumField, ResultCard, ResultRow, SubHead } from "./ui";

export function FuelCalc({ s, set, reset, currency, prefill, pre }: CalcProps<"fuel">) {
  const { t } = useT();
  const sym = currencySymbol(currency);
  const d = moneyDigits(currency);
  const L = t("calculators.units.l");
  const picked = prefill.machines.find((m) => m.id === s.machineId);

  const r = useMemo(() => {
    const input = {} as FuelInput;
    for (const k of Object.keys(s) as (keyof FuelState)[]) if (k !== "machineId") input[k] = parseNum(s[k]);
    return fuelCost(input);
  }, [s]);
  const f = (k: keyof FuelState) => ({ value: s[k], onChange: (v: string) => set({ [k]: v } as Partial<FuelState>) });

  const chart = [
    { name: t("calculators.fuel.byHours"), v: Math.round(r.byHours.cost) },
    { name: t("calculators.fuel.byVolume"), v: Math.round(r.byVolume.cost) },
    { name: t("calculators.fuel.monthlyCost"), v: Math.round(r.monthly.cost) },
  ];

  return (
    <CalcLayout
      inputs={<>
        <CalcCard title={t("calculators.fuel.price")} icon={Fuel} onReset={reset}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label={t("calculators.fuel.price")} unit={`${sym}${t("calculators.units.perL")}`} {...f("price")} prefilled={pre(s.price, prefill.fuelPrice)} />
            <MachineLphSelect machines={prefill.machines} value={s.machineId}
              onPick={(m) => set(m ? { machineId: m.id, lph: toInput(m.lph, 1) } : { machineId: "" })} />
          </div>
        </CalcCard>
        <div className="grid gap-5 sm:grid-cols-2">
          <CalcCard title={t("calculators.fuel.byHours")} icon={Clock}>
            <div className="space-y-3">
              <NumField label={t("calculators.fuel.lph")} unit={t("calculators.units.lph")} {...f("lph")}
                prefilled={picked ? s.lph === toInput(picked.lph, 1) && currency === "EUR" : pre(s.lph, prefill.avgLph, 1)}
                onChange={(v) => set({ lph: v, machineId: "" })} />
              <NumField label={t("calculators.fuel.hours")} unit={t("calculators.units.h")} {...f("hours")} />
            </div>
          </CalcCard>
          <CalcCard title={t("calculators.fuel.byVolume")} icon={Layers}>
            <div className="space-y-3">
              <NumField label={t("calculators.fuel.lpm3")} unit={t("calculators.units.lpm3")} {...f("lpm3")} />
              <NumField label={t("calculators.fuel.m3")} unit={t("calculators.units.m3")} {...f("m3")} />
            </div>
          </CalcCard>
        </div>
        <CalcCard title={t("calculators.fuel.monthly")} icon={CalendarRange}>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumField label={t("calculators.fuel.hoursPerDay")} unit={t("calculators.units.h")} {...f("hoursPerDay")} />
            <NumField label={t("calculators.fuel.daysPerMonth")} unit={t("calculators.units.days")} {...f("daysPerMonth")} />
            <NumField label={t("calculators.fuel.machines")} unit={t("calculators.units.pcs")} {...f("machines")} />
          </div>
          <p className="mt-2 text-[11px] text-faint">{t("calculators.fuel.monthlyHint", { h: fmtNumber(r.monthly.hours) })}</p>
        </CalcCard>
      </>}
      results={<>
        <ResultCard tone="amber">
          <SubHead>{t("calculators.fuel.byHours")}</SubHead>
          <div className="grid grid-cols-2 gap-4">
            <Hero label={t("calculators.fuel.cost")} value={r.byHours.cost} decimals={d} unit={sym} tone="amber" />
            <Hero label={t("calculators.fuel.litres")} value={r.byHours.litres} decimals={0} unit={L} />
          </div>
          <SubHead className="mt-5">{t("calculators.fuel.byVolume")}</SubHead>
          <div className="divide-y divide-line/60">
            <ResultRow label={t("calculators.fuel.cost")} value={r.byVolume.cost} decimals={d} unit={sym} />
            <ResultRow label={t("calculators.fuel.litres")} value={r.byVolume.litres} decimals={0} unit={L} />
            <ResultRow label={t("calculators.fuel.perM3")} value={r.byVolume.perM3} decimals={2} unit={`${sym}${t("calculators.units.perM3")}`} />
          </div>
          <SubHead className="mt-5">{t("calculators.fuel.monthly")}</SubHead>
          <div className="divide-y divide-line/60">
            <ResultRow label={t("calculators.fuel.litres")} value={r.monthly.litres} decimals={0} unit={L} />
            <ResultRow label={t("calculators.fuel.monthlyCost")} value={r.monthly.cost} decimals={d} unit={sym} />
            <ResultRow strong label={t("calculators.fuel.yearlyCost")} value={r.monthly.yearly} decimals={0} unit={sym} />
          </div>
        </ResultCard>
        <CalcCard title={t("calculators.fuel.compare")} icon={Fuel}>
          <Bars data={chart} x="name" series={[{ key: "v", label: t("calculators.fuel.cost") }]} unit={sym} height={180} />
        </CalcCard>
      </>}
    />
  );
}
