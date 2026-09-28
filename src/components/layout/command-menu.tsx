"use client";

import { ArrowRight, CornerDownLeft, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { globalSearch, type SearchHit } from "@/app/(app)/shell-actions";
import { Kbd } from "@/components/ui/misc";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./icons";

type Cmd = { id: string; label: string; href: string; icon: string; kind: "action" | "hit"; sub?: string };

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mjfg:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mjfg:command", onOpen); };
  }, []);
  return { open, setOpen };
}

export function CommandMenu({ open, onClose, perms }: { open: boolean; onClose: () => void; perms: string[] }) {
  const { t, label } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [idx, setIdx] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const ps = useMemo(() => new Set(perms), [perms]);

  const actions: Cmd[] = useMemo(() => {
    const a: Cmd[] = [
      { id: "s-emp", label: t("search.commands.employee"), href: "/employees", icon: "employees", kind: "action" },
      { id: "s-mach", label: t("search.commands.machine"), href: "/machines", icon: "machines", kind: "action" },
      { id: "s-proj", label: t("search.commands.project"), href: "/projects", icon: "projects", kind: "action" },
      { id: "n-exp", label: t("search.commands.expense"), href: "/expenses?new=1", icon: "expenses", kind: "action" },
      { id: "n-rep", label: t("search.commands.repair"), href: "/maintenance?new=repair", icon: "maintenance", kind: "action" },
      { id: "n-task", label: t("search.commands.task"), href: "/tasks?new=1", icon: "tasks", kind: "action" },
    ];
    return a.filter((x) => x.id !== "n-exp" || ps.has("create_expense"));
  }, [t, ps]);

  const items: Cmd[] = useMemo(() => {
    const filtered = q ? actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())) : actions;
    const h: Cmd[] = hits.map((x) => ({ id: `${x.entity_type}:${x.entity_id}`, label: x.title, sub: `${label("search.entity", x.entity_type)}${x.subtitle ? " · " + x.subtitle : ""}`, href: x.link, icon: iconFor(x.entity_type), kind: "hit" }));
    return [...h, ...filtered];
  }, [q, hits, actions, label]);

  useEffect(() => {
    if (open) { setQ(""); setHits([]); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const h = setTimeout(() => start(async () => { setHits(await globalSearch(q)); setIdx(0); }), 220);
    return () => clearTimeout(h);
  }, [q]);

  const go = useCallback((c: Cmd | undefined) => { if (!c) return; onClose(); router.push(c.href); }, [onClose, router]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm animate-fade-in" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={t("search.title")} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <Search className="h-4 w-4 text-muted" />}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); go(items[idx]); }
              else if (e.key === "Escape") onClose();
            }}
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t("search.noResults")}</li>}
          {items.map((c, i) => {
            const Icon = NAV_ICONS[c.icon] ?? Search;
            return (
              <li key={c.id} role="option" aria-selected={i === idx}>
                <button onMouseEnter={() => setIdx(i)} onClick={() => go(c)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === idx ? "bg-forest-800/60 text-ink" : "text-ink-2")}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3">
                    {c.kind === "action" && c.id.startsWith("n-") ? <Plus className="h-4 w-4 text-amber" /> : <Icon className="h-4 w-4 text-moss" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.label}</span>
                    {c.sub && <span className="block truncate text-xs text-muted">{c.sub}</span>}
                  </span>
                  {i === idx ? <CornerDownLeft className="h-3.5 w-3.5 text-muted" /> : <ArrowRight className="h-3.5 w-3.5 text-faint" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-faint">
          <span>{t("search.hint")}</span>
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>↵</Kbd></span>
        </div>
      </div>
    </div>
  );
}

function iconFor(type: string) {
  return ({ employee: "employees", machine: "machines", project: "projects", repair: "maintenance", expense: "expenses", task: "tasks", document: "documents", receipt: "receipts" } as Record<string, string>)[type] ?? "dashboard";
}
