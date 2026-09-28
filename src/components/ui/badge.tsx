import type { ReactNode } from "react";
import { cn, type Tone } from "@/lib/utils";

const tones: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok border-ok/25",
  warn: "bg-warn/12 text-warn border-warn/25",
  crit: "bg-crit/12 text-crit border-crit/30",
  off: "bg-off/15 text-muted border-off/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-surface-3 text-ink-2 border-line",
  forest: "bg-forest-700/40 text-moss border-forest-600/40",
  amber: "bg-amber/12 text-amber border-amber/30",
  wood: "bg-wood-700/40 text-wood-300 border-wood-500/30",
};

const dots: Record<Tone, string> = {
  ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", off: "bg-off", info: "bg-info", neutral: "bg-muted", forest: "bg-moss", amber: "bg-amber", wood: "bg-wood-300",
};

export function Badge({ tone = "neutral", children, dot, pulse, className, title }: {
  tone?: Tone; children: ReactNode; dot?: boolean; pulse?: boolean; className?: string; title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors duration-300", tones[tone], className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn("absolute inline-flex h-full w-full rounded-full animate-pulse-ring", dots[tone])} />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dots[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

export function DemoBadge() {
  return <Badge tone="amber" className="tracking-widest">DEMO</Badge>;
}
