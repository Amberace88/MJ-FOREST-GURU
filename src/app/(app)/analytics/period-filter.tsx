"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Props = { period: "this_month" | "last_month" | "custom"; from: string; to: string; className?: string };

/** URL-driven period selector: this month (default), last month or a custom from/to range. */
export function PeriodFilter({ period, from, to, className }: Props) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(period);
  const [f, setF] = useState(from);
  const [tt, setTt] = useState(to);

  const push = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    u.delete("page");
    start(() => router.replace(`${pathname}${u.toString() ? `?${u}` : ""}`, { scroll: false }));
  };

  const onPreset = (v: string) => {
    const next = v as Props["period"];
    setKey(next);
    if (next === "custom") push({ period: "custom", from: f, to: tt });
    else push({ period: next === "this_month" ? null : next, from: null, to: null });
  };

  const onDate = (which: "from" | "to", value: string) => {
    if (which === "from") setF(value); else setTt(value);
    const nf = which === "from" ? value : f;
    const nt = which === "to" ? value : tt;
    if (nf && nt && nf <= nt) push({ period: "custom", from: nf, to: nt });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70", className)} role="group" aria-label={t("analytics.period")}>
      <span className="hidden items-center gap-1.5 text-xs uppercase tracking-wider text-muted sm:flex"><CalendarRange className="h-4 w-4" /> {t("analytics.period")}</span>
      <select value={key} onChange={(e) => onPreset(e.target.value)} aria-label={t("analytics.period")}
        className="field h-10 w-auto min-w-[170px]">
        <option value="this_month">{t("common.thisMonth")}</option>
        <option value="last_month">{t("analytics.lastMonth")}</option>
        <option value="custom">{t("common.custom")}</option>
      </select>
      {key === "custom" && (
        <>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>{t("common.from")}</span>
            <input type="date" value={f} max={tt || undefined} onChange={(e) => onDate("from", e.target.value)} className="field h-10 w-auto" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>{t("common.to")}</span>
            <input type="date" value={tt} min={f || undefined} onChange={(e) => onDate("to", e.target.value)} className="field h-10 w-auto" />
          </label>
        </>
      )}
    </div>
  );
}
