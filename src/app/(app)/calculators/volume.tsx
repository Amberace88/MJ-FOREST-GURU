"use client";

import { ArrowLeftRight, Plus, Ruler, Trash2, Truck } from "lucide-react";
import { useMemo } from "react";
import { Bars } from "@/components/charts";
import { useT } from "@/i18n/client";
import { logsVolume, parseNum, solidToStacked, stackedToSolid, truckLoads } from "@/lib/calc";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toInput, type CalcProps } from "./state";
import { CalcCard, CalcLayout, Hero, NumField, ResultCard, ResultRow } from "./ui";

export function VolumeCalc({ s, set, reset }: CalcProps<"volume">) {
  const { t } = useT();
  const u = (k: "m3" | "cm" | "m" | "pcs" | "stacked" | "loads") => t(`calculators.units.${k}`);

  const logs = useMemo(() => logsVolume(s.rows.map((r) => ({ diameter: parseNum(r.d), length: parseNum(r.l), quantity: parseNum(r.q) }))), [s.rows]);
  const coef = parseNum(s.coef);
  const stackedVal = s.anchor === "stacked" ? parseNum(s.stacked) : solidToStacked(parseNum(s.solid), coef);
  const solidVal = s.anchor === "solid" ? parseNum(s.solid) : stackedToSolid(parseNum(s.stacked), coef);
  const loadVolume = s.useTotal ? logs.total : parseNum(s.loadVolume);
  const loads = truckLoads(loadVolume, parseNum(s.loadSize));

  const setRow = (id: number, patch: Partial<{ d: string; l: string; q: string }>) =>
    set({ rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const addRow = () => {
    const last = s.rows[s.rows.length - 1];
    const id = Math.max(0, ...s.rows.map((r) => r.id)) + 1;
    set({ rows: [...s.rows, { id, d: "", l: last?.l ?? "4", q: "1" }] });
  };
  const removeRow = (id: number) => set({ rows: s.rows.filter((r) => r.id !== id) });

  const chart = s.rows.map((r, i) => ({ name: `#${i + 1} · Ø${r.d || "—"}`, v: Math.round((logs.perRow[i] ?? 0) * 1000) / 1000 }));

  return (
    <CalcLayout
      inputs={<>
        <CalcCard title={t("calculators.volume.logs")} subtitle={t("calculators.volume.intro")} icon={Ruler} onReset={reset}>
          <div className="hidden grid-cols-[1.75rem_repeat(3,minmax(0,1fr))_5.5rem_2.25rem] gap-2 px-0.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted sm:grid">
            <span>#</span>
            <span>{t("calculators.volume.diameter")}</span>
            <span>{t("calculators.volume.length")}</span>
            <span>{t("calculators.volume.quantity")}</span>
            <span className="text-right">{t("calculators.volume.volume")}</span>
            <span />
          </div>
          <ul className="space-y-2">
            {s.rows.map((r, i) => (
              <li key={r.id} className="grid grid-cols-[1.75rem_repeat(3,minmax(0,1fr))_2.25rem] items-center gap-2 animate-fade-up sm:grid-cols-[1.75rem_repeat(3,minmax(0,1fr))_5.5rem_2.25rem]">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-3 text-[11px] font-semibold tabular text-muted">{i + 1}</span>
                <NumField compact value={r.d} onChange={(v) => setRow(r.id, { d: v })} unit={u("cm")} ariaLabel={`${t("calculators.volume.diameter")} #${i + 1}`} />
                <NumField compact value={r.l} onChange={(v) => setRow(r.id, { l: v })} unit={u("m")} ariaLabel={`${t("calculators.volume.length")} #${i + 1}`} />
                <NumField compact value={r.q} onChange={(v) => setRow(r.id, { q: v })} unit={u("pcs")} ariaLabel={`${t("calculators.volume.quantity")} #${i + 1}`} />
                <span className="hidden text-right text-sm font-medium tabular text-ink sm:block">{fmtNumber(logs.perRow[i] ?? 0, 3)}</span>
                <button type="button" onClick={() => removeRow(r.id)} disabled={s.rows.length <= 1} title={t("calculators.volume.removeRow")} aria-label={t("calculators.volume.removeRow")}
                  className="grid h-9 w-9 place-items-center rounded-lg text-faint transition hover:bg-crit/10 hover:text-crit disabled:pointer-events-none disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="col-span-full -mt-1 text-right text-xs tabular text-muted sm:hidden">
                  {t("calculators.volume.volume")}: <span className="font-medium text-ink">{fmtNumber(logs.perRow[i] ?? 0, 3)} {u("m3")}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addRow}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-2.5 text-sm text-muted transition hover:border-forest-500/60 hover:bg-forest-800/20 hover:text-ink">
            <Plus className="h-4 w-4" /> {t("calculators.volume.addRow")}
          </button>
        </CalcCard>

        <div className="grid gap-5 sm:grid-cols-2">
          <CalcCard title={t("calculators.volume.stacked")} subtitle={t("calculators.volume.stackedHint")} icon={ArrowLeftRight}>
            <div className="space-y-3">
              <NumField label={t("calculators.volume.stackedM")} unit={u("stacked")}
                value={s.anchor === "stacked" ? s.stacked : toInput(stackedVal, 2)}
                onChange={(v) => set({ stacked: v, anchor: "stacked" })} />
              <NumField label={t("calculators.volume.coefficient")} value={s.coef} hint={t("calculators.volume.coefficientHint")}
                onChange={(v) => set({ coef: v })} />
              <NumField label={t("calculators.volume.solidM3")} unit={u("m3")}
                value={s.anchor === "solid" ? s.solid : toInput(solidVal, 2)}
                onChange={(v) => set({ solid: v, anchor: "solid" })} />
            </div>
          </CalcCard>

          <CalcCard title={t("calculators.volume.perLoad")} icon={Truck}>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
                <input type="checkbox" checked={s.useTotal} onChange={(e) => set({ useTotal: e.target.checked })}
                  className="h-4 w-4 rounded border-line-strong accent-[var(--forest-500)]" />
                {t("calculators.volume.useTotal")}
              </label>
              <NumField label={t("calculators.volume.loadVolume")} unit={u("m3")}
                value={s.useTotal ? toInput(logs.total, 2) : s.loadVolume}
                onChange={(v) => set({ loadVolume: v, useTotal: false })} />
              <NumField label={t("calculators.volume.loadSize")} unit={u("m3")} value={s.loadSize} onChange={(v) => set({ loadSize: v })} />
              <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                <Hero label={t("calculators.volume.loadsNeeded")} value={loads.loads} unit={u("loads")} tone="amber"
                  sub={loads.loads > 0 ? t("calculators.volume.loadsDetail", { full: loads.full, rest: fmtNumber(loads.remainder, 1) }) : undefined} />
              </div>
            </div>
          </CalcCard>
        </div>
      </>}
      results={
        <ResultCard>
          <Hero label={t("calculators.volume.total")} value={logs.total} decimals={3} unit={u("m3")} tone="amber" />
          <div className="mt-4 divide-y divide-line/60">
            <ResultRow label={t("calculators.volume.pieces")} value={logs.pieces} unit={u("pcs")} />
            <ResultRow label={t("calculators.volume.avgPiece")} value={logs.pieces > 0 ? logs.total / logs.pieces : null} decimals={3} unit={u("m3")} />
            <ResultRow label={t("calculators.volume.solidM3")} value={solidVal} decimals={2} unit={u("m3")} />
            <ResultRow label={t("calculators.volume.stackedM")} value={stackedVal} decimals={2} unit={u("stacked")} />
          </div>
          <div className={cn("mt-4", chart.length === 0 && "hidden")}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t("calculators.volume.byRow")}</div>
            <Bars data={chart} x="name" series={[{ key: "v", label: t("calculators.volume.volume") }]} unit={u("m3")} height={170} />
          </div>
        </ResultCard>
      }
    />
  );
}
