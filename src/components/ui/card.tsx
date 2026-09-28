import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children, hover, as: As = "section", ...rest }: {
  className?: string; children: ReactNode; hover?: boolean; as?: "section" | "div" | "article"; id?: string;
}) {
  return <As className={cn("card", hover && "card-hover", className)} {...rest}>{children}</As>;
}

export function CardHeader({ title, subtitle, action, icon, className }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-moss">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold uppercase tracking-wider text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-ink tabular">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function DefinitionList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line/60 pb-2 sm:block sm:border-0 sm:pb-0">
          <dt className="text-xs uppercase tracking-wider text-muted">{it.label}</dt>
          <dd className="truncate text-sm text-ink sm:mt-0.5">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
