"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type FilterDef =
  | { type: "search"; name: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

/** URL-driven filters: every change updates searchParams (server-side filtering + pagination). */
export function FilterBar({ filters, className }: { filters: FilterDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useT();
  const [pending, start] = useTransition();
  const searchDef = filters.find((f) => f.type === "search");
  const [q, setQ] = useState(searchDef ? params.get(searchDef.name) ?? "" : "");
  const first = useRef(true);

  const push = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    u.delete("page");
    start(() => router.replace(`${pathname}${u.toString() ? `?${u}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!searchDef) return;
    const h = setTimeout(() => push({ [searchDef.name]: q.trim() || null }), 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = filters.filter((f) => f.type !== "search" && params.get(f.name)).length + (q ? 1 : 0);

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", pending && "opacity-70", className)} role="search">
      {searchDef && (
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchDef.type === "search" ? searchDef.placeholder ?? t("common.searchPlaceholder") : ""}
            aria-label={t("common.search")} className="field h-10 pl-9" />
        </div>
      )}
      {filters.map((f) => {
        if (f.type === "select") {
          return (
            <select key={f.name} aria-label={f.label} value={params.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value || null })}
              className={cn("field h-10 w-auto min-w-[140px] max-w-[220px]", params.get(f.name) && "border-forest-500/60 text-ink")}>
              <option value="">{f.label}: {t("common.all")}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          );
        }
        if (f.type === "date") {
          return (
            <label key={f.name} className="flex items-center gap-2 text-xs text-muted">
              <span>{f.label}</span>
              <input type="date" value={params.get(f.name) ?? ""} onChange={(e) => push({ [f.name]: e.target.value || null })} className="field h-10 w-auto" />
            </label>
          );
        }
        return null;
      })}
      {active > 0 && (
        <button onClick={() => { setQ(""); const u = new URLSearchParams(); const keep = params.get("tab"); if (keep) u.set("tab", keep); start(() => router.replace(`${pathname}${u.toString() ? `?${u}` : ""}`)); }}
          className="flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink">
          <X className="h-4 w-4" /> {t("common.clear")}
        </button>
      )}
    </div>
  );
}
