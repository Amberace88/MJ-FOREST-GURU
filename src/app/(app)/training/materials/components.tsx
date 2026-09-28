"use client";

import { BadgeCheck, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionForm } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import type { TocEntry } from "@/lib/training/format";
import { cn } from "@/lib/utils";
import { acknowledgeMaterial } from "./actions";

/* ------------------------------------------------------------------ table of contents with scroll-spy */
export function Toc({ entries, title, accent, mobile }: { entries: TocEntry[]; title: string; accent: string; mobile?: boolean }) {
  const [active, setActive] = useState<string | null>(entries[0]?.id ?? null);
  useEffect(() => {
    const els = entries.map((e) => document.getElementById(e.id)).filter((x): x is HTMLElement => Boolean(x));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [entries]);

  const list = (
    <ol className="space-y-0.5 text-sm">
      {entries.map((e, i) => (
        <li key={e.id}>
          <a href={`#${e.id}`}
            className={cn("group flex gap-2.5 rounded-lg border-l-2 py-1.5 pl-3 pr-2 leading-snug transition-colors",
              active === e.id ? "bg-surface-2 text-ink" : "border-transparent text-muted hover:bg-surface-2/60 hover:text-ink")}
            style={active === e.id ? { borderColor: accent } : undefined}>
            <span className="w-5 shrink-0 font-display text-xs font-semibold tabular opacity-70">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">{e.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  if (mobile) {
    return (
      <details className="card group overflow-hidden lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wider text-ink">
          <span>{title} <span className="ml-1 text-xs font-normal normal-case text-muted">{entries.length}</span></span>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line px-2 py-2">{list}</div>
      </details>
    );
  }
  return (
    <nav aria-label={title}>
      <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{title}</div>
      {list}
    </nav>
  );
}

/* ------------------------------------------------------------------ acknowledgement */
function AckSubmit() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button type="submit" disabled={pending}
      className="relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-forest-600 px-6 font-display text-base font-semibold uppercase tracking-wide text-on-accent shadow-[inset_0_1px_0_#ffffff1f,0_10px_30px_-10px_var(--forest-500)] transition-all hover:bg-forest-500 active:scale-[0.99] disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
      {t("materials.ackButton")}
    </button>
  );
}

export function AckForm({ materialId, version }: { materialId: string; version: number }) {
  return (
    <ActionForm action={acknowledgeMaterial.bind(null, materialId, version)} className="w-full shrink-0 sm:w-auto">
      <AckSubmit />
    </ActionForm>
  );
}
