import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, back, eyebrow, className }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; eyebrow?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-up", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide text-ink md:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, text, action, className }: {
  icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("topo-bg flex flex-col items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-moss">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-forest-600 to-forest-800 font-semibold text-ink ring-1 ring-line-strong", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden={!name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Progress({ value, tone = "forest", className }: { value: number; tone?: "forest" | "warn" | "crit" | "amber"; className?: string }) {
  const color = { forest: "bg-forest-400", warn: "bg-warn", crit: "bg-crit", amber: "bg-amber" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 px-1 pt-4 text-sm text-muted" aria-label="Lapas">
      <span className="tabular">{(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} / {total}</span>
      <div className="flex items-center gap-1">
        <Link aria-label="Iepriekšējā lapa" aria-disabled={page <= 1} href={hrefFor(Math.max(1, page - 1))}
          className={cn("grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-surface-2", page <= 1 && "pointer-events-none opacity-40")}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="px-2 tabular">{page} / {pages}</span>
        <Link aria-label="Nākamā lapa" aria-disabled={page >= pages} href={hrefFor(Math.min(pages, page + 1))}
          className={cn("grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-surface-2", page >= pages && "pointer-events-none opacity-40")}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  );
}

export function TabNav({ items, active }: { items: { key: string; label: string; href: string; count?: number | null }[]; active: string }) {
  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1" aria-label="Sadaļas">
      {items.map((it) => (
        <Link key={it.key} href={it.href} scroll={false} aria-current={active === it.key ? "page" : undefined}
          className={cn("relative whitespace-nowrap px-3 pb-3 pt-1 text-sm transition-colors",
            active === it.key ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-amber" : "text-muted hover:text-ink")}>
          {it.label}
          {it.count != null && it.count > 0 && <span className="ml-1.5 rounded-full bg-surface-3 px-1.5 text-[10px] tabular text-ink-2">{it.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-3 px-1.5 py-0.5 font-sans text-[10px] text-muted">{children}</kbd>;
}

export function NoPermission({ text }: { text: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-8 text-center text-sm text-muted">{text}</div>
  );
}
