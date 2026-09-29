"use client";

import { BOARD_COLUMNS } from "@/lib/constants";
import { AlertTriangle, CalendarClock, GripVertical, Tractor, TreePine, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { cn, priorityTone } from "@/lib/utils";
import { updateTaskStatus } from "./actions";

export type BoardStatus = (typeof BOARD_COLUMNS)[number];

export type BoardTask = {
  id: string; title: string; status: BoardStatus; priority: string; deadlineLabel: string | null; overdue: boolean;
  assigneeName: string | null; projectCode: string | null; machineName: string | null; canMove: boolean; mine: boolean;
};

const MIME = "application/x-mjfg-task";
const accent: Record<BoardStatus, string> = { todo: "bg-info", in_progress: "bg-warn", waiting: "bg-wood-300", done: "bg-ok" };

/** Kanban board: native HTML5 drag & drop, plus a status select on every card for touch / keyboard users. */
export function TaskBoard({ tasks: initial }: { tasks: BoardTask[] }) {
  const { t, label } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tasks, setTasks] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<BoardStatus | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setTasks(initial), [initial]);

  function move(id: string, status: BoardStatus) {
    const task = tasks.find((x) => x.id === id);
    if (!task || task.status === status || !task.canMove) return;
    const prev = tasks;
    setTasks((list) => [{ ...task, status, overdue: status === "done" ? false : task.overdue }, ...list.filter((x) => x.id !== id)]);
    setBusy(id);
    startTransition(async () => {
      const res = await updateTaskStatus(id, status);
      setBusy(null);
      if (!res.ok) {
        setTasks(prev);
        toast(res.error, "error");
        return;
      }
      toast(`${task.title} → ${label("tasks.status", status)}`, "ok");
      router.refresh();
    });
  }

  const taskHref = (id: string) => {
    const u = new URLSearchParams(params.toString());
    u.set("task", id);
    u.delete("new");
    return `${pathname}?${u}`;
  };

  const onDragStart = (e: DragEvent<HTMLElement>, task: BoardTask) => {
    if (!task.canMove) { e.preventDefault(); return; }
    e.dataTransfer.setData(MIME, task.id);
    e.dataTransfer.setData("text/plain", task.title);
    e.dataTransfer.effectAllowed = "move";
    setDragId(task.id);
  };
  const onDrop = (e: DragEvent<HTMLElement>, status: BoardStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(MIME) || dragId;
    setOver(null);
    setDragId(null);
    if (id) move(id, status);
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <p className="mb-3 hidden text-xs text-faint md:block">{t("tasks.dragHint")}</p>
      <div className="flex snap-x snap-mandatory gap-4 xl:grid xl:grid-cols-4">
        {BOARD_COLUMNS.map((col) => {
          const items = tasks.filter((x) => x.status === col);
          const dragging = dragId ? tasks.find((x) => x.id === dragId) : null;
          const canDropHere = Boolean(dragging && dragging.status !== col);
          return (
            <section key={col} aria-label={label("tasks.columns", col)}
              onDragOver={(e) => { if (canDropHere) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== col) setOver(col); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => onDrop(e, col)}
              className={cn("flex w-[84vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface/60 transition-colors sm:w-80 xl:w-auto xl:max-w-none",
                over === col && "border-forest-400/70 bg-forest-800/20", canDropHere && over !== col && "border-dashed")}>
              <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
                <span className={cn("h-2 w-2 rounded-full", accent[col])} aria-hidden />
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-ink">{label("tasks.columns", col)}</h2>
                <span className="ml-auto rounded-full bg-surface-3 px-2 text-xs tabular text-ink-2">{items.length}</span>
              </header>
              <ul className="flex min-h-[140px] flex-1 flex-col gap-2 px-2.5 pb-3">
                {items.map((task) => (
                  <li key={task.id} draggable={task.canMove} onDragStart={(e) => onDragStart(e, task)} onDragEnd={() => { setDragId(null); setOver(null); }}
                    className={cn("group card relative overflow-hidden p-3 transition-all animate-fade-up",
                      task.canMove && "cursor-grab active:cursor-grabbing",
                      task.overdue && "border-crit/50 shadow-[inset_3px_0_0_var(--crit)]",
                      dragId === task.id && "opacity-50", busy === task.id && "animate-pulse")}>
                    <div className="flex items-start gap-2">
                      {task.canMove && <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 text-faint md:block" aria-hidden />}
                      <Link href={taskHref(task.id)} scroll={false} className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink hover:text-amber">
                        {task.title}
                      </Link>
                      <Badge tone={priorityTone(task.priority)} dot pulse={task.priority === "critical" && col !== "done"}>{label("tasks.priority", task.priority)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {task.assigneeName && <span className={cn("flex items-center gap-1", task.mine && "text-amber")}><User className="h-3.5 w-3.5" />{task.assigneeName}</span>}
                      {task.projectCode && <span className="flex items-center gap-1"><TreePine className="h-3.5 w-3.5" />{task.projectCode}</span>}
                      {task.machineName && <span className="flex items-center gap-1"><Tractor className="h-3.5 w-3.5" />{task.machineName}</span>}
                      {task.deadlineLabel && (
                        <span className={cn("flex items-center gap-1", task.overdue && "font-medium text-crit")}>
                          {task.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                          {task.deadlineLabel}{task.overdue && ` · ${t("tasks.overdue")}`}
                        </span>
                      )}
                    </div>
                    {task.canMove && (
                      <label className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                        <span className="sr-only">{t("tasks.changeStatus")}</span>
                        <select value={task.status} disabled={busy === task.id} onChange={(e) => move(task.id, e.target.value as BoardStatus)}
                          aria-label={`${t("tasks.changeStatus")}: ${task.title}`}
                          className="field h-9 w-full py-0 text-xs xl:h-8">
                          {BOARD_COLUMNS.map((s) => <option key={s} value={s}>{label("tasks.status", s)}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-faint">{t("tasks.columnEmpty")}</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
