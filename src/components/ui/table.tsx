import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** hide on small screens (mobile shows the card layout instead) */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
};

/**
 * Responsive data table: a real <table> on desktop, stacked cards on phones
 * (employees must not navigate desktop tables on mobile — spec §67).
 */
export function DataTable<T>({ rows, columns, rowKey, href, empty, mobile, className }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  href?: (row: T) => string;
  empty?: ReactNode;
  mobile?: (row: T) => ReactNode;
  className?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className={cn("card overflow-hidden", className)}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted",
                  c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="group transition-colors hover:bg-surface-2/60">
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tabular", c.align === "center" && "text-center", c.className)}>
                    {href && i === 0 ? <Link href={href(r)} className="font-medium text-ink hover:text-amber">{c.cell(r)}</Link> : c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line/70 md:hidden">
        {rows.map((r) => {
          const content = mobile ? mobile(r) : (
            <div className="space-y-1">
              {columns.filter((c) => !c.hideOnMobile).map((c, i) => (
                <div key={c.key} className={cn("flex items-center justify-between gap-3", i === 0 ? "text-[15px] font-medium text-ink" : "text-sm")}>
                  {i > 0 && <span className="text-xs text-muted">{c.header}</span>}
                  <span className={cn(i === 0 ? "" : "text-right text-ink-2")}>{c.cell(r)}</span>
                </div>
              ))}
            </div>
          );
          return (
            <li key={rowKey(r)}>
              {href ? <Link href={href(r)} className="block px-4 py-3.5 active:bg-surface-2">{content}</Link> : <div className="px-4 py-3.5">{content}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
