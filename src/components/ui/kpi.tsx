import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";

export function KpiCard({ label, value, decimals = 0, suffix, sub, icon, tone = "forest", href, delay = 0, noData }: {
  label: string; value: number | null | undefined; decimals?: number; suffix?: string; sub?: ReactNode; icon: ReactNode;
  tone?: "forest" | "amber" | "crit" | "warn" | "info" | "wood"; href?: string; delay?: number; noData?: string;
}) {
  const ring = {
    forest: "from-forest-500/25 text-moss", amber: "from-amber/25 text-amber", crit: "from-crit/25 text-crit",
    warn: "from-warn/25 text-warn", info: "from-info/25 text-info", wood: "from-wood-500/30 text-wood-300",
  }[tone];
  const body = (
    <div className="card card-hover group relative h-full overflow-hidden p-4 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-xl", ring)} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-surface-3", ring.split(" ")[1])}>{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        {value === null || value === undefined ? (
          <span className="text-lg font-medium text-faint">{noData ?? "—"}</span>
        ) : (
          <>
            <span className="font-display text-[34px] font-bold leading-none text-ink"><AnimatedNumber value={Number(value)} decimals={decimals} /></span>
            {suffix && <span className="text-sm text-muted">{suffix}</span>}
          </>
        )}
      </div>
      {sub && <div className="mt-2 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-[14px]">{body}</Link> : body;
}
