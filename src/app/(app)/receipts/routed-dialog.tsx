"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * URL-driven modal (e.g. `?receipt=<id>`, `?task=<id>`): opens on mount, and
 * closing it navigates to `closeHref`. Children may be server-rendered.
 */
export function RoutedDialog({ title, description, closeHref, children, size = "lg", headerExtra }: {
  title: ReactNode; description?: ReactNode; closeHref: string; children: ReactNode; size?: "md" | "lg" | "xl"; headerExtra?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { t } = useT();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const width = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <dialog ref={ref} aria-labelledby="routed-dialog-title"
      className={cn("m-auto h-[100dvh] max-h-[100dvh] w-full rounded-none border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 sm:h-auto sm:max-h-[92vh] sm:w-[calc(100%-1.5rem)] sm:rounded-2xl", width)}
      // nested dialogs (edit forms) must not close this one: React propagates `close` through the tree
      onClose={(e) => { if (e.target === ref.current) router.replace(closeHref, { scroll: false }); }}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="flex h-full flex-col sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="routed-dialog-title" className="font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            <button type="button" onClick={() => ref.current?.close()} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("common.close")}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
