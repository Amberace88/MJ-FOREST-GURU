import { AlertTriangle, CalendarClock, Coins, FileSignature, Gauge, Info, Pencil, PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Bars, Donut, DonutLegend } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { FormDialog, FormGrid, Input, Select, type FormAction } from "@/components/ui/form";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, Progress } from "@/components/ui/misc";
import { CURRENCIES, currencySymbol, THIN_MARGIN_PCT, verdictFor, type Verdict } from "@/lib/calc";
import type { OrgContext } from "@/lib/context";
import { fmtDate, fmtHours, fmtMoney, fmtMoneyMap, fmtNumber, todayIn } from "@/lib/format";
import {
  CONTRACT_TYPES, CONTRACT_UNITS, COST_KEYS, loadProjectFinances, type FinanceProject, type ProjectFinance,
} from "@/lib/project-finance";
import { cn, type Tone } from "@/lib/utils";
import { MarginMeter } from "../../calculators/ui";
import { updateProjectFinance } from "./finance-actions";

const verdictTone: Record<Verdict, Tone> = { profit: "ok", thin: "warn", loss: "crit", unknown: "neutral" };
const kpiTone = (v: Verdict) => (v === "profit" ? "forest" : v === "thin" ? "warn" : v === "loss" ? "crit" : "info");
const usageTone = (pct: number) => (pct > 100 ? "crit" : pct > 85 ? "warn" : "forest");

export function VerdictBadge({ ctx, verdict, className }: { ctx: OrgContext; verdict: Verdict; className?: string }) {
  return (
    <Badge tone={verdictTone[verdict]} dot pulse={verdict === "loss"} className={className}>
      {ctx.t(`finance.verdict.${verdict}`)}
    </Badge>
  );
}

/** "15,00 € / m³", "12 000,00 €", "35,00 € / h" */
function contractSummary(ctx: OrgContext, f: ProjectFinance) {
  if (!f.hasContract || f.contractPrice === null || !f.contractType) return null;
  const price = fmtMoney(f.contractPrice, f.currency);
  const type = ctx.t(`finance.contractTypes.${f.contractType}`);
  if (f.contractType === "per_unit") return `${type} · ${price} / ${ctx.label("production.units", f.contractUnit)}`;
  if (f.contractType === "hourly") return `${type} · ${price} / h`;
  return `${type} · ${price}`;
}

export async function FinanceTab({ ctx, project }: { ctx: OrgContext; project: FinanceProject }) {
  const today = todayIn(ctx.timezone);
  const f = (await loadProjectFinances(ctx, [project], today)).get(project.id)!;
  const canEdit = ctx.can("manage_projects") && ctx.can("view_finance");
  const sym = currencySymbol(f.currency);
  const cur = f.currency;
  const unitLabel = ctx.label("production.units", f.contractUnit);

  const costRows = COST_KEYS
    .filter((k) => f.costs[k] !== null && (f.costs[k] ?? 0) > 0)
    .map((k) => ({ name: ctx.t(`finance.costParts.${k}`), value: Math.round((f.costs[k] ?? 0) * 100) / 100 }));
  const other = fmtMoneyMap(f.otherCurrencies);
  const summary = contractSummary(ctx, f);

  const edit = canEdit ? (
    <FormDialog size="md" title={ctx.t("finance.editContract")} description={ctx.t("finance.editContractText")}
      action={updateProjectFinance.bind(null, project.id) as FormAction} successMessage={ctx.t("finance.saved")}
      trigger={<Button size="sm" variant="secondary"><Pencil className="h-4 w-4" /> {ctx.t("finance.editContract")}</Button>}>
      <FormGrid>
        <Select name="contract_type" label={ctx.t("finance.contractType")} placeholder="" defaultValue={project.contract_type ?? ""}
          options={CONTRACT_TYPES.map((c) => ({ value: c, label: ctx.t(`finance.contractTypes.${c}`) }))} />
        <Input name="contract_price" type="number" step="0.01" min="0" inputMode="decimal" label={ctx.t("finance.contractPrice")}
          hint={ctx.t("finance.contractPriceHint")} defaultValue={project.contract_price ?? ""} />
        <Select name="contract_currency" label={ctx.t("finance.currency")} defaultValue={project.contract_currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <Select name="contract_unit" label={ctx.t("finance.unit")} defaultValue={project.contract_unit}
          options={CONTRACT_UNITS.map((u) => ({ value: u, label: ctx.label("production.units", u) }))} />
        <Input name="expected_volume" type="number" step="0.01" min="0" inputMode="decimal" label={ctx.t("finance.expectedVolume")} optional
          hint={ctx.t("finance.expectedVolumeHint")} defaultValue={project.expected_volume ?? ""} />
        <Input name="budget_hours" type="number" step="0.5" min="0" inputMode="decimal" label={ctx.t("finance.budgetHours")} optional
          defaultValue={project.budget_hours ?? ""} />
        <Input name="budget_cost" type="number" step="0.01" min="0" inputMode="decimal" label={ctx.t("finance.budgetCost")} optional
          defaultValue={project.budget_cost ?? ""} className="sm:col-span-2" />
      </FormGrid>
    </FormDialog>
  ) : null;

  const current = { name: ctx.t("finance.allTime"), revenue: Math.round(f.revenue ?? 0), cost: Math.round(f.totalCost), profit: Math.round(f.profit ?? 0) };
  const compare = f.forecast
    ? [current, { name: ctx.t("finance.forecast"), revenue: Math.round(f.forecast.revenue ?? 0), cost: Math.round(f.forecast.cost), profit: Math.round(f.forecast.profit ?? 0) }]
    : null;

  return (
    <div className="space-y-6">
      {/* contract strip */}
      <div className="card topo-bg flex flex-col gap-3 p-4 animate-fade-up sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber/12 text-amber"><FileSignature className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("finance.contract")} · {ctx.t("finance.allTime")}</div>
            <div className="truncate font-medium text-ink">{summary ?? ctx.t("finance.noContract")}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge ctx={ctx} verdict={f.verdict} className="px-3 py-1 text-xs" />
          {f.hasContract && edit}
        </div>
      </div>

      {!f.hasContract && (
        <EmptyState icon={<Coins className="h-6 w-6" />} title={ctx.t("finance.noContract")} text={ctx.t("finance.noContractText")} action={edit} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ctx.t("finance.revenue")} value={f.revenue} suffix={sym} icon={<Wallet className="h-4 w-4" />} tone="info"
          noData={ctx.t("finance.revenueUnknown")} sub={summary ?? undefined} />
        <KpiCard label={ctx.t("finance.costs")} value={f.totalCost} suffix={sym} icon={<Receipt className="h-4 w-4" />} tone="wood" delay={60}
          sub={f.costPerM3 !== null ? `${fmtMoney(f.costPerM3, cur)} / m³` : undefined} />
        <KpiCard label={ctx.t("finance.profit")} value={f.profit} suffix={sym} icon={<PiggyBank className="h-4 w-4" />} tone={kpiTone(f.verdict)} delay={120}
          noData="—" />
        <KpiCard label={ctx.t("finance.margin")} value={f.marginPct} decimals={1} suffix="%" icon={<TrendingUp className="h-4 w-4" />} tone={kpiTone(f.verdict)} delay={180}
          noData="—" sub={f.marginPct !== null ? <MarginHint pct={f.marginPct} /> : undefined} />
      </div>

      {f.marginPct !== null && (
        <Card className="p-4">
          <MarginMeter marginPct={f.marginPct} thinPct={THIN_MARGIN_PCT} />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* cost structure */}
        <Card>
          <CardHeader title={ctx.t("finance.costStructure")} subtitle={fmtMoney(f.totalCost, cur)} icon={<Receipt className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            {costRows.length ? (
              <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Donut data={costRows} unit={sym} height={200} />
                <DonutLegend data={costRows} unit={sym} />
              </div>
            ) : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              <Stat label={ctx.t("finance.hours")} value={fmtHours(f.hours)} />
              <Stat label={ctx.t("finance.produced")} value={f.volume > 0 ? `${fmtNumber(f.volume, 1)} ${unitLabel}` : "—"}
                hint={Object.entries(f.production).filter(([u]) => u !== f.contractUnit).map(([u, q]) => `${fmtNumber(q, 1)} ${ctx.label("production.units", u)}`).join(" · ") || undefined} />
              <Stat label={ctx.t("finance.costPerM3")} value={f.costPerM3 !== null ? fmtMoney(f.costPerM3, cur) : "—"} />
              <Stat label={ctx.t("finance.costParts.fuel")} value={fmtMoney(f.costs.fuel ?? 0, cur)} hint={ctx.t("finance.fuelLitres", { l: fmtNumber(f.fuelLitres) })} />
            </div>
            <div className="space-y-2">
              {!f.labourKnown && <Note icon={<Info className="h-3.5 w-3.5" />}>{ctx.t("finance.labourHidden")} <span className="text-faint">({ctx.t("finance.costParts.labour")}: {ctx.t("finance.noRate")})</span></Note>}
              {f.labourKnown && f.unratedHours > 0 && <Note tone="warn" icon={<AlertTriangle className="h-3.5 w-3.5" />}>{ctx.t("finance.unratedHours", { h: fmtHours(f.unratedHours) })}</Note>}
              {other && <Note icon={<Coins className="h-3.5 w-3.5" />}>{ctx.t("finance.otherCurrencies")}: <span className="font-medium text-ink tabular">{other}</span></Note>}
            </div>
          </CardBody>
        </Card>

        {/* progress, budget and forecast */}
        <Card>
          <CardHeader title={ctx.t("finance.budget")} icon={<Gauge className="h-4 w-4" />} />
          <CardBody className="space-y-5">
            <Meter label={ctx.t("finance.progress")} pct={f.progress !== null ? f.progress * 100 : null}
              detail={f.progress !== null ? ctx.t(f.progressMethod === "volume" ? "finance.progressByVolume" : "finance.progressByTime") : ctx.t("finance.progressUnknown")}
              right={project.expected_volume ? `${fmtNumber(f.volume, 1)} / ${fmtNumber(project.expected_volume, 1)} ${unitLabel}` : undefined} neutral />
            {f.budget.hours !== null || f.budget.cost !== null ? (
              <>
                {f.budget.hoursPct !== null && (
                  <Meter label={ctx.t("finance.hoursBudget")} pct={f.budget.hoursPct}
                    right={`${fmtNumber(f.hours, 1)} / ${fmtNumber(f.budget.hours, 1)} h`} />
                )}
                {f.budget.costPct !== null && (
                  <Meter label={ctx.t("finance.costBudget")} pct={f.budget.costPct}
                    right={`${fmtMoney(f.totalCost, cur)} / ${fmtMoney(f.budget.cost, cur)}`} />
                )}
              </>
            ) : <p className="text-sm text-muted">{ctx.t("finance.noBudget")}</p>}

            <div className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber" />
                  <span className="font-display text-sm font-semibold uppercase tracking-wider">{ctx.t("finance.forecast")}</span>
                </div>
                {f.forecast && <VerdictBadge ctx={ctx} verdict={verdictFor(f.forecast.marginPct)} />}
              </div>
              {f.forecast ? (
                <>
                  <p className="mb-3 text-xs text-muted">{ctx.t("finance.forecastText")}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Stat label={ctx.t("finance.forecastRevenue")} value={f.forecast.revenue !== null ? fmtMoney(f.forecast.revenue, cur) : "—"} />
                    <Stat label={ctx.t("finance.forecastCost")} value={fmtMoney(f.forecast.cost, cur)} />
                    <Stat label={ctx.t("finance.forecastProfit")} value={f.forecast.profit !== null ? fmtMoney(f.forecast.profit, cur) : "—"} />
                    <Stat label={ctx.t("finance.forecastMargin")} value={f.forecast.marginPct !== null ? `${fmtNumber(f.forecast.marginPct, 1)} %` : "—"} />
                    <Stat label={ctx.t("finance.forecastHours")} value={fmtHours(f.forecast.hours)} />
                    <Stat label={ctx.t("finance.forecastFinish")} value={fmtDate(f.forecast.finishDate)} />
                  </div>
                  {f.forecast.overBudget !== null && (
                    <Note tone="crit" className="mt-3" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                      {ctx.t("finance.forecastOverBudget", { amount: fmtMoney(f.forecast.overBudget, cur) })}
                    </Note>
                  )}
                </>
              ) : <p className="text-sm text-muted">{ctx.t("finance.forecastUnavailable")}</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      {f.hasContract && (
        <Card>
          <CardHeader title={`${ctx.t("finance.revenue")} · ${ctx.t("finance.costs")} · ${ctx.t("finance.profit")}`} icon={<TrendingUp className="h-4 w-4" />} />
          <CardBody>
            <Bars data={compare ?? [current]} x="name" unit={sym} height={230}
              series={[
                { key: "revenue", label: ctx.t("finance.revenue"), color: "#7fa6c9" },
                { key: "cost", label: ctx.t("finance.costs"), color: "#c09a6b" },
                { key: "profit", label: ctx.t("finance.profit"), color: "#5a9866" },
              ]} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function MarginHint({ pct }: { pct: number }) {
  return <span className={cn("tabular", pct < 0 ? "text-crit" : pct < THIN_MARGIN_PCT ? "text-warn" : "text-ok")}>{pct >= 0 ? "▲" : "▼"} {fmtNumber(Math.abs(pct), 1)} %</span>;
}

function Meter({ label, pct, detail, right, neutral }: { label: string; pct: number | null; detail?: string; right?: string; neutral?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-2">{label}{detail && <span className="ml-1.5 text-xs text-faint">{detail}</span>}</span>
        <span className="shrink-0 tabular text-ink">
          {right && <span className="mr-2 text-xs text-muted">{right}</span>}
          {pct !== null ? `${fmtNumber(pct, 0)} %` : "—"}
        </span>
      </div>
      <Progress value={pct ?? 0} tone={neutral ? "amber" : usageTone(pct ?? 0)} className="h-2" />
    </div>
  );
}

function Note({ children, icon, tone = "info", className }: { children: ReactNode; icon: ReactNode; tone?: "info" | "warn" | "crit"; className?: string }) {
  const cls = { info: "border-line bg-surface-2/50 text-muted", warn: "border-warn/30 bg-warn/10 text-warn", crit: "border-crit/30 bg-crit/10 text-crit" }[tone];
  return <p className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", cls, className)}><span className="mt-px shrink-0">{icon}</span><span>{children}</span></p>;
}
