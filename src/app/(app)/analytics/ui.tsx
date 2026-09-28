import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pctChange } from "./period";

/** "+12 % pret iepr. periodu" chip. `invert` = lower is better (costs, downtime). */
export function Delta({ current, previous, label, invert, className }: {
  current: number | null | undefined; previous: number | null | undefined; label?: string; invert?: boolean; className?: string;
}) {
  const pct = pctChange(current, previous);
  if (pct === null) return null;
  const flat = Math.abs(pct) < 0.5;
  const good = flat ? null : invert ? pct < 0 : pct > 0;
  const Icon = flat ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular",
      good === null ? "text-muted" : good ? "text-ok" : "text-crit", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pct > 0 ? "+" : ""}{new Intl.NumberFormat("lv-LV", { maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0 }).format(pct)} %
      {label && <span className="text-faint">{label}</span>}
    </span>
  );
}

/** Compact metric tile with optional comparison line. */
export function Metric({ label, value, sub, delta, className }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; delta?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("card min-w-0 p-4 animate-fade-up", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 truncate font-display text-[28px] font-bold leading-none text-ink tabular">{value}</div>
      {(sub || delta) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {delta}
          {sub && <span className="truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/** Simple responsive table used by analytics/report sections (horizontal scroll on phones). */
export function MiniTable({ head, rows, empty, className }: {
  head: { label: ReactNode; align?: "left" | "right" }[]; rows: ReactNode[][]; empty?: ReactNode; className?: string;
}) {
  if (!rows.length) return <p className="py-2 text-sm text-muted">{empty ?? "—"}</p>;
  return (
    <div className={cn("-mx-5 overflow-x-auto px-5", className)}>
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={i} scope="col" className={cn("whitespace-nowrap py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted last:pr-0",
                h.align === "right" && "text-right")}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((r, i) => (
            <tr key={i} className="break-inside-avoid">
              {r.map((c, j) => (
                <td key={j} className={cn("py-2 pr-3 align-top last:pr-0", head[j]?.align === "right" && "text-right tabular whitespace-nowrap")}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
