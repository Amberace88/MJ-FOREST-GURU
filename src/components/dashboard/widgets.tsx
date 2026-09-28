import {
  AlertTriangle, Camera, ClipboardList, Clock, Fuel, HardHat, Plus, Receipt, ShieldCheck, Siren, Timer, Tractor, TreePine, Users, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Translator } from "@/i18n";
import { cn } from "@/lib/utils";

export type Stats = {
  timezone: string;
  employees_total: number; employees_working: number; employees_worked_today: number;
  machines_total: number; machines_active: number; machines_down: number;
  projects_active: number; hours_today: number;
  fuel_litres_today: number | null; fuel_cost_today: Record<string, number>;
  expenses_today: Record<string, number>; expenses_pending: number;
  repairs_open: number; repairs_critical: number; incidents_open: number; tasks_open: number;
  production_today: Record<string, number>; alerts: number;
};

type QA = { href: string; label: string; Icon: LucideIcon; tone?: "amber" | "forest" | "crit" };

export function OwnerQuickActions({ tr, perms }: { tr: Translator; perms: Set<string> }) {
  const items: (QA & { need?: string })[] = [
    { href: "/projects?new=1", label: tr.t("quick.project"), Icon: TreePine, need: "manage_projects" },
    { href: "/employees?new=1", label: tr.t("quick.employee"), Icon: Users, need: "edit_employees" },
    { href: "/machines?new=1", label: tr.t("quick.machine"), Icon: Tractor, need: "manage_machines" },
    { href: "/tasks?new=1", label: tr.t("quick.task"), Icon: ClipboardList, need: "manage_tasks" },
    { href: "/maintenance?new=repair", label: tr.t("quick.repair"), Icon: Wrench },
    { href: "/expenses?new=1", label: tr.t("quick.expense"), Icon: Wallet, need: "create_expense" },
    { href: "/fuel?new=1", label: tr.t("quick.addFuel"), Icon: Fuel },
  ];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.filter((i) => !i.need || perms.has(i.need)).map((i) => (
        <Link key={i.href} href={i.href}
          className="group flex shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink-2 transition hover:-translate-y-0.5 hover:border-forest-500/50 hover:bg-forest-800/40 hover:text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-amber/15 text-amber"><Plus className="h-3.5 w-3.5" /></span>
          <i.Icon className="h-4 w-4 text-muted group-hover:text-moss" />
          <span className="font-display uppercase tracking-wider">{i.label}</span>
        </Link>
      ))}
      {perms.has("approve_expense") && (
        <Link href="/expenses?status=submitted" className="flex shrink-0 items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-sm font-medium text-amber hover:bg-amber/15">
          <Receipt className="h-4 w-4" /> {tr.t("quick.approveExpense")}
        </Link>
      )}
    </div>
  );
}

export function EmployeeQuickActions({ tr, active }: { tr: Translator; active: boolean }) {
  const items: QA[] = [
    { href: "/work", label: active ? tr.t("work.active") : tr.t("quick.startWork"), Icon: Timer, tone: active ? "forest" : "amber" },
    { href: "/hours", label: tr.t("quick.myHours"), Icon: Clock },
    { href: "/report?type=fuel", label: tr.t("quick.fuel"), Icon: Fuel },
    { href: "/report?type=repair", label: tr.t("quick.reportRepair"), Icon: Wrench },
    { href: "/report?type=expense", label: tr.t("quick.expenses"), Icon: Wallet },
    { href: "/report?type=photo", label: tr.t("quick.photo"), Icon: Camera },
    { href: "/tasks", label: tr.t("quick.tasks"), Icon: ClipboardList },
    { href: "/safety", label: tr.t("quick.safety"), Icon: HardHat },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i, idx) => (
        <Link key={i.href} href={i.href}
          className={cn("card card-hover group flex min-h-[112px] flex-col justify-between p-4 animate-fade-up",
            idx === 0 && "col-span-2 min-h-[132px] sm:col-span-2",
            i.tone === "amber" && "border-amber/40 bg-[linear-gradient(135deg,#e2a23b26,transparent_60%)]",
            i.tone === "forest" && "border-forest-500/50 bg-[linear-gradient(135deg,#3a7a4833,transparent_60%)]")}
          style={{ animationDelay: `${idx * 40}ms` }}>
          <i.Icon className={cn("h-7 w-7", i.tone === "amber" ? "text-amber" : "text-moss")} />
          <span className={cn("font-display font-bold uppercase tracking-wider text-ink", idx === 0 ? "text-2xl" : "text-base")}>{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

export function MiniStat({ icon: Icon, label, value, href, tone }: { icon: LucideIcon; label: string; value: React.ReactNode; href?: string; tone?: "crit" | "warn" | "ok" }) {
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3 transition hover:border-line-strong">
      <Icon className={cn("h-5 w-5", tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-moss")} />
      <span className="flex-1 text-sm text-ink-2">{label}</span>
      <span className="font-display text-xl font-bold tabular">{value}</span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export const Icons = { AlertTriangle, Siren, ShieldCheck, Wrench, Users, Tractor, TreePine, Clock, Fuel, Wallet };
