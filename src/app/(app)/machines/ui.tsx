import { Axe, Bus, Car, Caravan, Cog, Forklift, Shovel, Tractor, Trees, Truck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import type { Translator } from "@/i18n";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { healthTone, progressTone, type HealthResult } from "./health";

/** Fleet presentation atoms (server- and client-safe: no hooks). */

const ICONS: Record<string, LucideIcon> = {
  harvester: Axe, forwarder: Forklift, tractor: Tractor, skidder: Trees, mulcher: Shovel,
  truck: Truck, trailer: Caravan, van: Bus, car: Car, other: Cog,
};

export const MACHINE_CATEGORIES = ["harvester", "forwarder", "tractor", "skidder", "mulcher", "truck", "trailer", "van", "car", "other"] as const;
export const MACHINE_STATUSES = ["active", "idle", "maintenance", "broken", "offline"] as const;

export function CategoryIcon({ category, className, size = "md" }: { category: string | null | undefined; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = ICONS[category ?? "other"] ?? Cog;
  const box = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-14 w-14 rounded-2xl" }[size];
  const icon = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center bg-gradient-to-br from-forest-700/70 to-surface-3 text-moss ring-1 ring-line-strong", box, className)} aria-hidden>
      <Icon className={icon} />
    </span>
  );
}

export function HealthBadge({ h, tr, className }: { h: HealthResult; tr: Translator; className?: string }) {
  return (
    <Badge tone={healthTone(h.health)} dot pulse={h.health === "critical"} className={className}>
      {tr.label("machines.health", h.health)}
    </Badge>
  );
}

/** Progress through the current service interval with remaining engine hours. */
export function ServiceMeter({ h, tr, compact }: { h: HealthResult; tr: Translator; compact?: boolean }) {
  if (h.progress == null && h.remaining == null) {
    return <p className="text-xs text-faint">{tr.t("machines.noServiceData")}</p>;
  }
  const remainingText = h.remaining == null
    ? "—"
    : h.remaining < 0
      ? tr.t("machines.overdueBy", { n: fmtNumber(Math.abs(h.remaining)) })
      : tr.t("machines.remainingHours", { n: fmtNumber(h.remaining) });
  return (
    <div>
      {!compact && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted">{tr.t("machines.nextService")}</span>
          <span className="tabular text-ink-2">{h.nextHours != null ? `${fmtNumber(h.nextHours)} h` : "—"}</span>
        </div>
      )}
      <Progress value={h.progress ?? (h.remaining != null && h.remaining < 0 ? 100 : 0)} tone={progressTone(h.health)} />
      <div className={cn("mt-1 text-right text-[11px] tabular", h.remaining != null && h.remaining < 0 ? "text-crit" : "text-faint")}>{remainingText}</div>
    </div>
  );
}
