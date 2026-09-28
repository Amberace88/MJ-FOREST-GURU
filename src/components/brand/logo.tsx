import Image from "next/image";
import { cn } from "@/lib/utils";

/** Emblem (from the company logo) + typographic wordmark that reads on dark UI. */
export function Logo({ compact, className, subtitle }: { compact?: boolean; className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image src="/brand/emblem.png" alt="" width={44} height={31} priority className="h-auto w-11 shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="font-display text-[19px] font-bold uppercase tracking-[0.06em] text-ink">
            MJ <span className="text-ink">Forest</span> <span className="text-moss">Guru</span>
          </div>
          {subtitle && <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-muted">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return <Image src="/brand/logo-dark-bg.png" alt="MJ Forest Guru" width={1400} height={476} priority className={cn("h-auto w-full", className)} />;
}
