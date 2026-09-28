import { companyColor } from "@/lib/companies";
import { cn } from "@/lib/utils";

/** Colored company dot (server + client safe). */
export function CompanyDot({ color, className }: { color: string | null | undefined; className?: string }) {
  const c = companyColor(color);
  return (
    <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: c, boxShadow: `0 0 0 3px ${c}26` }} />
  );
}

/** Small pill with the company's color dot + name. */
export function CompanyBadge({ name, color, className, title }: { name: string; color: string | null | undefined; className?: string; title?: string }) {
  const c = companyColor(color);
  return (
    <span title={title ?? name}
      className={cn("inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 text-ink-2", className)}
      style={{ borderColor: `${c}55`, backgroundColor: `${c}1f` }}>
      <CompanyDot color={c} className="h-1.5 w-1.5" />
      <span className="truncate">{name}</span>
    </span>
  );
}
