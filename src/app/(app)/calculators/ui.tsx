"use client";

import { RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/client";
import { currencySymbol, type Currency, type Verdict } from "@/lib/calc";
import { cn } from "@/lib/utils";

/** Same order as the chart palette so legends match Donut/Bars colours. */
export const CHART_COLORS = ["#5a9866", "#e2a23b", "#7fa6c9", "#c09a6b", "#8fae6b", "#d97757", "#9d8fd1", "#6fb3a8"];

export const moneyDigits = (c: Currency) => (c === "ISK" ? 0 : 2);

/* ------------------------------------------------------------------ inputs */

export function NumField({ label, value, onChange, unit, hint, prefilled, className, compact, ariaLabel }: {
  label?: ReactNode; value: string; onChange: (v: string) => void; unit?: string; hint?: ReactNode;
  prefilled?: boolean; className?: string; compact?: boolean; ariaLabel?: string;
}) {
  const id = useId();
  const { t } = useT();
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 flex min-h-4 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
          <span className="truncate">{label}</span>
          {prefilled && (
            <span title={t("calculators.prefilledHint")} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber/12 px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-amber animate-fade-in">
              <Sparkles className="h-2.5 w-2.5" aria-hidden /> {t("calculators.prefilled")}
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s-]/g, ""))}
          onFocus={(e) => e.currentTarget.select()}
          className={cn("field tabular", compact ? "py-2 text-sm" : "", unit && "pr-14", prefilled && "border-amber/35")}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-faint">{unit}</span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ segmented control */

export function Segmented<T extends string>({ options, value, onChange, className, size = "md", ariaLabel }: {
  options: { value: T; label: ReactNode; icon?: LucideIcon; title?: string }[];
  value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md"; ariaLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-active="true"]`);
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <div ref={wrap} role="tablist" aria-label={ariaLabel}
      className={cn("relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1", className)}>
      {pill && (
        <span aria-hidden className="absolute bottom-1 top-1 rounded-lg bg-forest-700/60 ring-1 ring-forest-500/40 transition-[left,width] duration-300 ease-out"
          style={{ left: pill.left, width: pill.width }} />
      )}
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={active} data-active={active} title={o.title}
            onClick={() => onChange(o.value)}
            className={cn("relative z-10 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-10 px-3.5 text-sm",
              active ? "text-ink" : "text-muted hover:text-ink")}>
            {Icon && <Icon className={cn("h-4 w-4", active ? "text-amber" : "")} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ cards & results */

export function CalcCard({ title, subtitle, icon: Icon, onReset, children, className, action }: {
  title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; onReset?: () => void; children: ReactNode; className?: string; action?: ReactNode;
}) {
  const { t } = useT();
  return (
    <section className={cn("card animate-fade-up", className)}>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss"><Icon className="h-4 w-4" /></span>}
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold uppercase tracking-wider text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {onReset && (
            <button type="button" onClick={onReset} title={t("calculators.reset")}
              className="group inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted transition hover:bg-surface-2 hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:-rotate-180" aria-hidden />
              <span className="hidden sm:inline">{t("calculators.reset")}</span>
            </button>
          )}
        </div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function SubHead({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-3 mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint", className)}>{children}</h3>;
}

/** Big highlighted result number. */
export function Hero({ label, value, decimals = 0, unit, tone = "ink", sub }: {
  label: ReactNode; value: number | null; decimals?: number; unit?: string; tone?: "ink" | "ok" | "warn" | "crit" | "amber"; sub?: ReactNode;
}) {
  const color = { ink: "text-ink", ok: "text-ok", warn: "text-warn", crit: "text-crit", amber: "text-amber" }[tone];
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={cn("mt-1.5 flex items-baseline gap-1.5 font-display font-bold leading-none transition-colors duration-300", color)}>
        <span className="truncate text-[38px] sm:text-[44px]">{value === null ? "—" : <AnimatedNumber value={value} decimals={decimals} duration={450} />}</span>
        {unit && value !== null && <span className="text-base font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function ResultRow({ label, value, decimals = 0, unit, strong, tone, dot }: {
  label: ReactNode; value: number | null; decimals?: number; unit?: string; strong?: boolean; tone?: "ok" | "crit" | "warn"; dot?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", strong && "border-t border-line pt-2.5 font-semibold")}>
      <span className="flex min-w-0 items-center gap-2 text-ink-2">
        {dot && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: dot }} />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 tabular", tone === "ok" ? "text-ok" : tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ink")}>
        {value === null ? "—" : <AnimatedNumber value={value} decimals={decimals} duration={450} />}
        {unit && value !== null && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </span>
    </div>
  );
}

export function Money({ value, currency, className }: { value: number | null; currency: Currency; className?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className={className}>—</span>;
  return (
    <span className={cn("tabular", className)}>
      <AnimatedNumber value={value} decimals={moneyDigits(currency)} duration={450} /> {currencySymbol(currency)}
    </span>
  );
}

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { t } = useT();
  const tone = verdict === "profit" ? "ok" : verdict === "thin" ? "warn" : verdict === "loss" ? "crit" : "neutral";
  return (
    <Badge tone={tone} dot pulse={verdict === "loss"} className={cn("px-2.5 py-1 text-xs", className)}>
      {t(`calculators.verdict.${verdict}`)}
    </Badge>
  );
}

/** Horizontal margin gauge (-20 % … +40 %) with loss / thin / profit zones and an animated marker. */
export function MarginMeter({ marginPct, thinPct }: { marginPct: number | null; thinPct: number }) {
  const MIN = -20;
  const MAX = 40;
  const pos = (v: number) => ((Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="pt-1" aria-hidden>
      <div className="relative h-2.5 overflow-visible rounded-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <div className="h-full bg-crit/45" style={{ width: `${pos(0)}%` }} />
          <div className="h-full bg-warn/45" style={{ width: `${pos(thinPct) - pos(0)}%` }} />
          <div className="h-full flex-1 bg-ok/45" />
        </div>
        {marginPct !== null && (
          <div className="absolute -top-1 h-4.5 w-1.5 -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_3px_var(--surface)] transition-[left] duration-500 ease-out"
            style={{ left: `${pos(marginPct)}%` }} />
        )}
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] leading-3 tabular text-faint">
        <span className="absolute left-0">{MIN} %</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(0)}%` }}>0 %</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${pos(thinPct)}%` }}>{thinPct} %</span>
        <span className="absolute right-0">{MAX}+ %</span>
      </div>
    </div>
  );
}

/** Layout: inputs on the left, results on the right (stacked on mobile). */
export function CalcLayout({ inputs, results }: { inputs: ReactNode; results: ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="min-w-0 space-y-5">{inputs}</div>
      <div className="min-w-0 space-y-5">{results}</div>
    </div>
  );
}

/** Results card with an accent glow whose colour follows the verdict. */
export function ResultCard({ children, tone = "forest", className }: { children: ReactNode; tone?: "forest" | "ok" | "warn" | "crit" | "amber"; className?: string }) {
  const glow = { forest: "from-forest-500/25", ok: "from-ok/25", warn: "from-warn/25", crit: "from-crit/25", amber: "from-amber/25" }[tone];
  return (
    <section className={cn("card topo-bg relative overflow-hidden p-5 animate-fade-up", className)} style={{ animationDelay: "60ms" }}>
      <div className={cn("pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-colors duration-500", glow)} />
      <div className="relative">{children}</div>
    </section>
  );
}
