import { ChevronRight, Coins, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { THIN_MARGIN_PCT } from "@/lib/calc";
import type { OrgContext } from "@/lib/context";
import { fmtMoney, fmtNumber, todayIn } from "@/lib/format";
import { FINANCE_PROJECT_COLUMNS, loadProjectFinances, type FinanceProject, type ProjectFinance } from "@/lib/project-finance";
import { cn } from "@/lib/utils";

const LIMIT = 6;

/**
 * Dashboard widget: active projects with contract data ranked by margin
 * (visible only with view_finance; amounts in each project's contract currency).
 */
export async function ProfitabilityCard({ ctx }: { ctx: OrgContext }) {
  if (!ctx.can("view_finance")) return null;

  let q = ctx.supabase.from("projects").select(`${FINANCE_PROJECT_COLUMNS}, country_id`)
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null).eq("status", "active")
    .not("contract_type", "is", null).not("contract_price", "is", null)
    .order("updated_at", { ascending: false }).limit(40);
  if (ctx.countryId) q = q.eq("country_id", ctx.countryId);
  const { data } = await q;
  const projects: FinanceProject[] = data ?? [];

  const finances = await loadProjectFinances(ctx, projects, todayIn(ctx.timezone));
  const rows = projects
    .map((p) => ({ p, f: finances.get(p.id) }))
    .filter((r): r is { p: FinanceProject; f: ProjectFinance } => !!r.f)
    .sort((a, b) => (b.f.marginPct ?? -Infinity) - (a.f.marginPct ?? -Infinity))
    .slice(0, LIMIT);

  return (
    <Card className="animate-fade-up">
      <CardHeader title={ctx.t("finance.card.title")} subtitle={ctx.t("finance.card.subtitle")} icon={<TrendingUp className="h-4 w-4" />}
        action={<Link href="/projects" className="text-xs text-muted hover:text-amber">{ctx.t("common.viewAll")}</Link>} />
      <CardBody>
        {rows.length === 0 ? (
          <Link href="/projects" className="topo-bg flex items-center gap-3 overflow-hidden rounded-xl border border-dashed border-line-strong px-4 py-5 text-sm text-muted transition hover:border-amber/40 hover:text-ink">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-amber"><Coins className="h-4 w-4" /></span>
            {ctx.t("finance.card.empty")}
          </Link>
        ) : (
          <ul className="-mx-2 divide-y divide-line/60">
            {rows.map(({ p, f }, i) => <Row key={p.id} ctx={ctx} p={p} f={f} delay={i * 50} />)}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ ctx, p, f, delay }: { ctx: OrgContext; p: FinanceProject; f: ProjectFinance; delay: number }) {
  const m = f.marginPct;
  const tone = f.verdict === "profit" ? "ok" : f.verdict === "thin" ? "warn" : f.verdict === "loss" ? "crit" : "neutral";
  const revenue = f.revenue ?? 0;
  // cost share of revenue (wood) + remaining profit share (green); red when costs exceed revenue
  const costShare = revenue > 0 ? Math.min(100, (f.totalCost / revenue) * 100) : f.totalCost > 0 ? 100 : 0;
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Link href={`/projects/${p.id}?tab=finance`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-sm font-semibold uppercase tracking-wide text-ink group-hover:text-amber">{p.code}</span>
            <span className="truncate text-xs text-muted">{p.name}</span>
          </div>
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className={cn("h-full transition-[width] duration-700 ease-out", m !== null && m < 0 ? "bg-crit" : "bg-wood-500")} style={{ width: `${costShare}%` }} />
            {m !== null && m > 0 && <div className={cn("h-full transition-[width] duration-700 ease-out", m < THIN_MARGIN_PCT ? "bg-warn" : "bg-ok")} style={{ width: `${100 - costShare}%` }} />}
          </div>
          <div className="mt-1 flex gap-3 text-[11px] tabular text-faint">
            <span>{ctx.t("finance.revenue")}: <span className="text-ink-2">{f.revenue !== null ? fmtMoney(f.revenue, f.currency, true) : "—"}</span></span>
            <span>{ctx.t("finance.costs")}: <span className="text-ink-2">{fmtMoney(f.totalCost, f.currency, true)}</span></span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Badge tone={tone} className="tabular">{m !== null ? `${fmtNumber(m, 1)} %` : ctx.t("finance.verdict.unknown")}</Badge>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-faint">{ctx.t("finance.card.margin")}</div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-amber" />
      </Link>
    </li>
  );
}
