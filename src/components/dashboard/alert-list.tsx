import { AlertOctagon, AlertTriangle, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import type { Translator } from "@/i18n";
import { cn } from "@/lib/utils";

export type AlertRow = {
  alert_key: string; severity: string; alert_type: string; title: string; detail: string; link: string; occurred_at: string | null;
};

const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function sortAlerts(a: AlertRow[]) {
  return [...a].sort((x, y) => (ORDER[x.severity] ?? 9) - (ORDER[y.severity] ?? 9));
}

/** Each alert is clickable and opens the related record (spec §16). */
export function AlertList({ alerts, tr, limit, dense }: { alerts: AlertRow[]; tr: Translator; limit?: number; dense?: boolean }) {
  const list = sortAlerts(alerts).slice(0, limit ?? alerts.length);
  if (list.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ok/20 bg-ok/5 px-4 py-4 text-sm text-ok">
        <span className="h-2 w-2 rounded-full bg-ok" /> {tr.t("dashboard.attentionEmpty")}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {list.map((a, i) => {
        const Icon = a.severity === "critical" ? AlertOctagon : a.severity === "warning" ? AlertTriangle : Info;
        return (
          <li key={a.alert_key} className="animate-slide-in-right" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            <Link href={a.link}
              className={cn("group flex items-center gap-3 rounded-xl border px-3.5 transition-colors",
                dense ? "py-2" : "py-2.5",
                a.severity === "critical" ? "border-crit/30 bg-crit/[0.07] hover:bg-crit/[0.12]"
                  : a.severity === "warning" ? "border-warn/25 bg-warn/[0.06] hover:bg-warn/[0.1]"
                  : "border-line bg-surface-2/60 hover:bg-surface-3")}>
              <Icon className={cn("h-4.5 w-4.5 shrink-0", a.severity === "critical" ? "text-crit" : a.severity === "warning" ? "text-warn" : "text-info")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                <span className="block truncate text-xs text-muted">{a.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
