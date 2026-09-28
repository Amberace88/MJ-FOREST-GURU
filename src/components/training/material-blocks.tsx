import { CircleCheck, CircleX, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Block, CalloutTone, Inline } from "@/lib/training/format";
import { cn } from "@/lib/utils";

/**
 * Renders parsed markdown-lite blocks as a styled document. No hooks and no
 * "use client": used by the server reader page and the client editor preview.
 */
export type BlockLabels = { do: string; dont: string; crit: string; warn: string; tip: string };

export function InlineText({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((s, i) => (s.bold ? <strong key={i} className="font-semibold text-ink">{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

const CALLOUT: Record<CalloutTone, { box: string; icon: ReactNode; title: string }> = {
  crit: { box: "border-crit/35 bg-crit/[0.08]", icon: <OctagonAlert className="h-5 w-5 text-crit" aria-hidden />, title: "text-crit" },
  warn: { box: "border-warn/35 bg-warn/[0.08]", icon: <TriangleAlert className="h-5 w-5 text-warn" aria-hidden />, title: "text-warn" },
  tip: { box: "border-info/30 bg-info/[0.08]", icon: <Lightbulb className="h-5 w-5 text-info" aria-hidden />, title: "text-info" },
};

export function MaterialBlocks({ blocks, labels, accent = "var(--forest-500)", className }: {
  blocks: Block[]; labels: BlockLabels; accent?: string; className?: string;
}) {
  let section = 0;
  const style = { "--mat-accent": accent } as CSSProperties;
  return (
    <div className={cn("material-doc space-y-5 text-[15px] leading-7 text-ink-2", className)} style={style}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            if (b.level === 3) {
              return <h3 key={i} id={b.id} className="scroll-mt-28 pt-2 text-base font-semibold text-ink">{b.text}</h3>;
            }
            section++;
            return (
              <h2 key={i} id={b.id} className={cn("scroll-mt-28 flex items-baseline gap-3 font-display text-[22px] font-bold uppercase leading-tight tracking-wide text-ink", i > 0 && "border-t border-line pt-8 mt-10")}>
                <span className="font-display text-sm font-semibold tabular text-[var(--mat-accent)]">{String(section).padStart(2, "0")}</span>
                <span>{b.text}</span>
              </h2>
            );
          case "paragraph":
            return <p key={i}><InlineText content={b.content} /></p>;
          case "list":
            return (
              <ul key={i} className="space-y-2 pl-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mat-accent)]" aria-hidden />
                    <span className="min-w-0"><InlineText content={it} /></span>
                  </li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="relative space-y-3">
                {b.items.map((it, j) => (
                  <li key={j} className="relative flex gap-3.5">
                    {j < b.items.length - 1 && <span className="absolute left-[13px] top-8 bottom-[-12px] w-px bg-line-strong" aria-hidden />}
                    <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-600 text-xs font-bold tabular text-on-accent shadow-[0_0_0_4px_var(--surface)]">{j + 1}</span>
                    <span className="min-w-0 pt-0.5"><InlineText content={it} /></span>
                  </li>
                ))}
              </ol>
            );
          case "do":
          case "dont": {
            const ok = b.type === "do";
            return (
              <div key={i} className={cn("rounded-xl border px-4 py-3", ok ? "border-ok/25 bg-ok/[0.06]" : "border-crit/25 bg-crit/[0.06]")}>
                <div className={cn("mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]", ok ? "text-ok" : "text-crit")}>{ok ? labels.do : labels.dont}</div>
                <ul className="space-y-2">
                  {b.items.map((it, j) => (
                    <li key={j} className="flex gap-2.5">
                      {ok ? <CircleCheck className="mt-1 h-[18px] w-[18px] shrink-0 text-ok" aria-hidden /> : <CircleX className="mt-1 h-[18px] w-[18px] shrink-0 text-crit" aria-hidden />}
                      <span className="min-w-0"><InlineText content={it} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          case "callout": {
            const c = CALLOUT[b.tone];
            return (
              <aside key={i} className={cn("flex gap-3 rounded-xl border px-4 py-3.5", c.box)} role={b.tone === "crit" ? "alert" : "note"}>
                <span className="mt-0.5 shrink-0">{c.icon}</span>
                <div className="min-w-0">
                  <div className={cn("text-[13px] font-semibold uppercase tracking-wide", c.title)}>{b.title ?? labels[b.tone]}</div>
                  <p className="mt-0.5 text-ink"><InlineText content={b.content} /></p>
                </div>
              </aside>
            );
          }
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm leading-6">
                  <thead>
                    <tr className="bg-surface-3">
                      {b.header.map((h, j) => (
                        <th key={j} scope="col" className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink">
                          <InlineText content={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-line even:bg-surface-2/60">
                        {r.map((c, k) => (
                          <td key={k} className={cn("px-3.5 py-2.5 align-top", k === 0 ? "font-medium text-ink" : "text-ink-2")}><InlineText content={c} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
