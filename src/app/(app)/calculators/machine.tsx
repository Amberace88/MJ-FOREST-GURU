"use client";

import { ArrowRight, Banknote, Gauge, Tractor } from "lucide-react";
import { useMemo } from "react";
import { Bars } from "@/components/charts";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { currencySymbol, machineHourlyCost, parseNum, type MachineInput } from "@/lib/calc";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { toInput, type CalcProps, type MachineLph, type MachineState } from "./state";
import { CalcCard, CalcLayout, CHART_COLORS, Hero, moneyDigits, NumField, ResultCard, ResultRow } from "./ui";

type PartKey = "depreciation" | "interest" | "insurance" | "maintenance" | "fuel" | "operator";
const PARTS: PartKey[] = ["depreciation", "interest", "insurance", "maintenance", "fuel", "operator"];

/** Select of machines with measured consumption; picking one fills L/h. */
export function MachineLphSelect({ machines, value, onPick }: { machines: MachineLph[]; value: string; onPick: (m: MachineLph | null) => void }) {
  const { t, label } = useT();
  if (!machines.length) return null;
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">{t("calculators.machine.fromMachine")}</label>
      <select className="field py-2 text-sm" value={value}
        onChange={(e) => onPick(machines.find((m) => m.id === e.target.value) ?? null)}>
        <option value="">—</option>
        {machines.map((m) => (
          <option key={m.id} value={m.id}>{m.name} · {label("machines.categories", m.category)} · {fmtNumber(m.lph, 1)} L/h</option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-faint">{t("calculators.machine.fromMachineHint")}</p>
    </div>
  );
}

export function MachineCalc({ s, set, reset, currency, prefill, pre, onUseRate }: CalcProps<"machine"> & {
  onUseRate: (target: "harvesterRate" | "forwarderRate", value: string) => void;
}) {
  const { t } = useT();
  const sym = currencySymbol(currency);
  const d = moneyDigits(currency);
  const perH = `${sym}/${t("calculators.units.h")}`;
  const picked = prefill.machines.find((m) => m.id === s.machineId);

  const r = useMemo(() => {
    const input = {} as MachineInput;
    for (const k of Object.keys(s) as (keyof MachineState)[]) if (k !== "machineId") input[k] = parseNum(s[k]);
    return machineHourlyCost(input);
  }, [s]);

  const chart = PARTS.map((k) => ({ name: t(`calculators.machine.parts.${k}`), v: Math.round(r.parts[k] * 100) / 100 }));
  const f = (k: keyof MachineState) => ({ value: s[k], onChange: (v: string) => set({ [k]: v } as Partial<MachineState>) });

  const use = (target: "harvesterRate" | "forwarderRate") => {
    onUseRate(target, toInput(r.machineOnly, 2));
    toast(t("calculators.machine.applied"), "ok");
  };

  return (
    <CalcLayout
      inputs={<>
        <CalcCard title={t("calculators.machine.investment")} icon={Banknote} onReset={reset}>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label={t("calculators.machine.purchasePrice")} unit={sym} {...f("purchasePrice")} />
            <NumField label={t("calculators.machine.residual")} unit={t("calculators.units.pct")} {...f("residualPct")}
              hint={fmtMoney(r.residual, currency)} />
            <NumField label={t("calculators.machine.years")} unit={t("calculators.units.years")} {...f("years")} />
            <NumField label={t("calculators.machine.hoursPerYear")} unit={t("calculators.units.h")} {...f("hoursPerYear")} />
            <NumField label={t("calculators.machine.interest")} unit={t("calculators.units.pct")} {...f("interestPct")} />
            <NumField label={t("calculators.machine.insurance")} unit={`${sym}${t("calculators.units.perYear")}`} {...f("insuranceTaxPerYear")} />
          </div>
        </CalcCard>
        <CalcCard title={t("calculators.machine.running")} icon={Gauge}>
          <div className="grid gap-3 sm:grid-cols-2">
            <MachineLphSelect machines={prefill.machines} value={s.machineId}
              onPick={(m) => set(m ? { machineId: m.id, fuelLph: toInput(m.lph, 1) } : { machineId: "" })} />
            <NumField label={t("calculators.machine.fuelLph")} unit={t("calculators.units.lph")} {...f("fuelLph")}
              prefilled={picked ? s.fuelLph === toInput(picked.lph, 1) && currency === "EUR" : pre(s.fuelLph, prefill.avgLph, 1)}
              onChange={(v) => set({ fuelLph: v, machineId: "" })} />
            <NumField label={t("calculators.machine.fuelPrice")} unit={`${sym}${t("calculators.units.perL")}`} {...f("fuelPrice")}
              prefilled={pre(s.fuelPrice, prefill.fuelPrice)} />
            <NumField label={t("calculators.machine.maintenance")} unit={perH} {...f("maintenancePerHour")} />
            <NumField label={t("calculators.machine.operator")} unit={perH} {...f("operatorPerHour")}
              prefilled={pre(s.operatorPerHour, prefill.hourlyRate)} />
            <NumField label={t("calculators.machine.markup")} unit={t("calculators.units.pct")} {...f("markupPct")} />
          </div>
        </CalcCard>
      </>}
      results={<>
        <ResultCard tone="amber">
          <div className="grid grid-cols-2 gap-4">
            <Hero label={t("calculators.machine.total")} value={r.total} decimals={2} unit={perH} />
            <Hero label={t("calculators.machine.suggested")} value={r.suggestedRate} decimals={2} unit={perH} tone="amber"
              sub={`+${fmtNumber(parseNum(s.markupPct), 0)} %`} />
          </div>
          <div className="mt-4 divide-y divide-line/60">
            {PARTS.map((k, i) => (
              <ResultRow key={k} dot={CHART_COLORS[i]} label={<>{t(`calculators.machine.parts.${k}`)} <span className="text-faint">· {fmtNumber(r.total > 0 ? (r.parts[k] / r.total) * 100 : 0, 0)}%</span></>}
                value={r.parts[k]} decimals={2} unit={perH} />
            ))}
            <ResultRow strong label={t("calculators.machine.perYear")} value={r.perYear} decimals={d} unit={sym} />
          </div>
        </ResultCard>
        <CalcCard title={t("calculators.machine.breakdown")} icon={Tractor}>
          <Bars data={chart} x="name" series={[{ key: "v", label: t("calculators.machine.breakdown") }]} unit={perH} height={210} horizontal />
          <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
            <ResultRow label={t("calculators.machine.machineOnly")} value={r.machineOnly} decimals={2} unit={perH} />
            <p className="mt-1 text-[11px] text-faint">{t("calculators.machine.useHint")}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => use("harvesterRate")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-amber/50 hover:text-amber">
                {t("calculators.machine.useHarvester")} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => use("forwarderRate")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-amber/50 hover:text-amber">
                {t("calculators.machine.useForwarder")} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CalcCard>
      </>}
    />
  );
}
