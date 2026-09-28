"use client";

import { Fuel, Ruler, TrendingUp, Tractor, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { CURRENCIES, isCurrency, SOCIAL_TAX_PRESETS, type Currency } from "@/lib/calc";
import { FuelCalc } from "./fuel";
import { LabourCalc } from "./labour";
import { MachineCalc } from "./machine";
import { ProfitCalc } from "./profit";
import { CURRENCY_COUNTRY, makeDefaults, mergeSaved, TABS, toInput, type CalcPrefill, type CalcState, type Tab } from "./state";
import { Segmented } from "./ui";
import { VolumeCalc } from "./volume";

const STORAGE_KEY = "mjfg:calculators:v1";
const ICONS = { volume: Ruler, profit: TrendingUp, machine: Tractor, fuel: Fuel, labour: Users } as const;

export function Calculators({ prefill, initialTab }: { prefill: CalcPrefill; initialTab: Tab }) {
  const { t } = useT();
  const defaults = useMemo(() => makeDefaults(prefill), [prefill]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [state, setState] = useState<CalcState>(defaults);
  const loaded = useRef(false);

  // Restore the last inputs (per browser) after hydration; persist on change.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { state?: unknown; currency?: unknown };
        setState(mergeSaved(defaults, saved.state));
        if (isCurrency(saved.currency)) setCurrency(saved.currency);
      }
    } catch { /* ignore corrupt storage */ }
    loaded.current = true;
  }, [defaults]);
  useEffect(() => {
    if (!loaded.current) return;
    const id = window.setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, currency })); } catch { /* quota / private mode */ }
    }, 250);
    return () => window.clearTimeout(id);
  }, [state, currency]);

  const update = useCallback(<K extends keyof CalcState>(key: K, patch: Partial<CalcState[K]>) =>
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } })), []);
  const reset = useCallback((key: keyof CalcState) => setState((s) => ({ ...s, [key]: defaults[key] })), [defaults]);

  const changeTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "volume") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  };

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    // keep the social tax in sync with the currency's country unless the user typed a custom rate
    setState((s) => {
      if (s.labour.country === "custom") return s;
      const country = CURRENCY_COUNTRY[next];
      return { ...s, labour: { ...s.labour, country, socialTaxPct: toInput(SOCIAL_TAX_PRESETS[country], 2) } };
    });
  };

  const pre = useCallback((value: string, p: number | null, digits = 2) => currency === "EUR" && p !== null && value === toInput(p, digits), [currency]);
  const common = { currency, prefill, pre };

  return (
    <div className="space-y-5">
      <div className="sticky top-[60px] z-20 -mx-4 flex flex-col gap-2 border-b border-line/60 bg-bg/85 px-4 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:top-[76px] lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
        <Segmented ariaLabel={t("calculators.title")} value={tab} onChange={changeTab}
          options={TABS.map((k) => ({ value: k, icon: ICONS[k], title: t(`calculators.tabs.${k}`),
            label: <><span className="sm:hidden">{t(`calculators.tabsShort.${k}`)}</span><span className="hidden sm:inline">{t(`calculators.tabs.${k}`)}</span></> }))} />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{t("calculators.currency")}</span>
          <Segmented size="sm" ariaLabel={t("calculators.currency")} value={currency} onChange={changeCurrency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </div>
      </div>

      <div key={tab} className="animate-fade-up" role="tabpanel">
        {tab === "volume" && <VolumeCalc s={state.volume} set={(p) => update("volume", p)} reset={() => reset("volume")} {...common} />}
        {tab === "profit" && <ProfitCalc s={state.profit} set={(p) => update("profit", p)} reset={() => reset("profit")} {...common} />}
        {tab === "machine" && (
          <MachineCalc s={state.machine} set={(p) => update("machine", p)} reset={() => reset("machine")} {...common}
            onUseRate={(target, value) => { update("profit", { [target]: value }); changeTab("profit"); }} />
        )}
        {tab === "fuel" && <FuelCalc s={state.fuel} set={(p) => update("fuel", p)} reset={() => reset("fuel")} {...common} />}
        {tab === "labour" && <LabourCalc s={state.labour} set={(p) => update("labour", p)} reset={() => reset("labour")} {...common} />}
      </div>
    </div>
  );
}
