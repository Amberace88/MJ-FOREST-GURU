"use client";

import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; message: string; tone: "ok" | "error" | "info" };
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: ToastItem["tone"] = "ok") {
  const id = ++seq;
  items = [...items.slice(-3), { id, message, tone }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => items,
    () => items,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} role="status"
          className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface-2/95 px-4 py-3 text-sm shadow-2xl backdrop-blur animate-slide-up",
            t.tone === "ok" && "border-ok/30", t.tone === "error" && "border-crit/40", t.tone === "info" && "border-info/30")}>
          {t.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crit" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
          <span className="flex-1 text-ink">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Aizvērt"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
