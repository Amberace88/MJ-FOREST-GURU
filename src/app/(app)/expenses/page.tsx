import type { Metadata } from "next";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Hourglass, Wallet } from "lucide-react";
import Link from "next/link";
import { ExpenseTable, type ExpenseRow } from "@/components/shared/lists";
import { Card } from "@/components/ui/card";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { PageHeader, Pagination, TabNav } from "@/components/ui/misc";
import { companyFilterOptions, pickCompanyFilter } from "@/lib/companies";
import { requirePermission } from "@/lib/context";
import { fmtMoney, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one } from "@/lib/utils";
import { defaultCurrency, receiptFormOptions } from "../receipts/options";
import { NewExpenseDialog } from "./components";

export const metadata: Metadata = { title: "Izdevumi" };
const PAGE = 30;
const STATUSES = ["submitted", "draft", "correction_requested", "approved", "rejected", "paid"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

type SP = Record<string, string | string[] | undefined>;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requirePermission("create_expense", "view_finance", "approve_expense");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const status = (STATUSES as readonly string[]).includes(one(sp.status) ?? "") ? one(sp.status)! : null;
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(one(sp.category) ?? "") ? one(sp.category)! : null;
  const seesOthers = ctx.canAny("view_finance", "approve_expense");
  const employee = seesOthers && UUID_RE.test(one(sp.employee) ?? "") ? one(sp.employee)! : null;
  const project = UUID_RE.test(one(sp.project) ?? "") ? one(sp.project)! : null;
  const country = UUID_RE.test(one(sp.country) ?? "") ? one(sp.country)! : ctx.countryId;
  const company = pickCompanyFilter(one(sp.company), ctx.companiesAll, ctx.companyId);
  const from = DATE_RE.test(one(sp.from) ?? "") ? one(sp.from)! : null;
  const to = DATE_RE.test(one(sp.to) ?? "") ? one(sp.to)! : null;
  const term = likeTerm(one(sp.q));
  const mine = one(sp.mine) === "1";

  // --- page of rows
  let rowsQ = ctx.supabase.from("expenses")
    .select("id, expense_date, amount, currency, category, status, description, receipt_id, employee:employees(id, full_name), project:projects(id, code)", { count: "exact" })
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .order("expense_date", { ascending: false }).order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) rowsQ = rowsQ.eq("status", status);
  if (category) rowsQ = rowsQ.eq("category", category);
  if (employee) rowsQ = rowsQ.eq("employee_id", employee);
  if (project) rowsQ = rowsQ.eq("project_id", project);
  if (country) rowsQ = rowsQ.eq("country_id", country);
  if (company) rowsQ = rowsQ.eq("company_id", company);
  if (from) rowsQ = rowsQ.gte("expense_date", from);
  if (to) rowsQ = rowsQ.lte("expense_date", to);
  if (term) rowsQ = rowsQ.ilike("description", term);
  if (mine) rowsQ = rowsQ.eq("created_by", ctx.user.id);

  // --- KPI source: same filters, all pages (money is aggregated per currency, never converted)
  let kpiQ = ctx.supabase.from("expenses").select("amount, currency, status")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).limit(10000);
  if (status) kpiQ = kpiQ.eq("status", status);
  if (category) kpiQ = kpiQ.eq("category", category);
  if (employee) kpiQ = kpiQ.eq("employee_id", employee);
  if (project) kpiQ = kpiQ.eq("project_id", project);
  if (country) kpiQ = kpiQ.eq("country_id", country);
  if (company) kpiQ = kpiQ.eq("company_id", company);
  if (from) kpiQ = kpiQ.gte("expense_date", from);
  if (to) kpiQ = kpiQ.lte("expense_date", to);
  if (term) kpiQ = kpiQ.ilike("description", term);
  if (mine) kpiQ = kpiQ.eq("created_by", ctx.user.id);

  let pendingQ = ctx.supabase.from("expenses").select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.org.id).is("deleted_at", null).eq("status", "submitted");
  if (country) pendingQ = pendingQ.eq("country_id", country);
  if (company) pendingQ = pendingQ.eq("company_id", company);

  const canCreate = ctx.can("create_expense");
  const [rowsRes, kpiRes, pendingRes, opts, formOptions] = await Promise.all([
    rowsQ, kpiQ, pendingQ, getOptions(ctx), canCreate ? receiptFormOptions(ctx) : Promise.resolve(null),
  ]);
  const rows = (rowsRes.data ?? []) as unknown as ExpenseRow[];
  const pending = pendingRes.count ?? 0;

  type Agg = { total: number; pending: number; approved: number; paid: number; count: number };
  const byCurrency = new Map<string, Agg>();
  for (const r of kpiRes.data ?? []) {
    const a = byCurrency.get(r.currency) ?? { total: 0, pending: 0, approved: 0, paid: 0, count: 0 };
    const amt = Number(r.amount);
    a.count += 1;
    if (r.status !== "rejected") a.total += amt;
    if (r.status === "submitted") a.pending += amt;
    if (r.status === "approved") a.approved += amt;
    if (r.status === "paid") a.paid += amt;
    byCurrency.set(r.currency, a);
  }
  const currencies = [...byCurrency.entries()].sort(([a], [b]) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)));

  const tabHref = (s: string | null) => `/expenses${searchParamsToString(sp, { status: s, page: null, new: null })}`;
  const filters: FilterDef[] = [
    { type: "search", name: "q", placeholder: ctx.t("expenses.searchPlaceholder") },
    { type: "select", name: "category", label: ctx.t("common.category"), options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: ctx.label("expenses.categories", c) })) },
    ...(seesOthers ? [{ type: "select" as const, name: "employee", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
    { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
    ...(ctx.countryId ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: opts.countryOptions }]),
    ...(ctx.companyId || ctx.companies.length < 2 ? [] : [{ type: "select" as const, name: "company", label: ctx.t("companies.company"), options: companyFilterOptions(ctx.companies) }]),
    ...(seesOthers ? [{ type: "select" as const, name: "mine", label: ctx.t("expenses.owner"), options: [{ value: "1", label: ctx.t("expenses.mine") }] }] : []),
    { type: "date", name: "from", label: ctx.t("common.from") },
    { type: "date", name: "to", label: ctx.t("common.to") },
  ];

  return (
    <>
      <PageHeader title={ctx.t("expenses.title")} subtitle={ctx.t("expenses.subtitle")}
        actions={canCreate && formOptions && (
          <NewExpenseDialog orgId={ctx.org.id} options={formOptions} defaultCurrency={defaultCurrency(ctx)} today={todayIn(ctx.timezone)}
            employees={ctx.can("view_finance") ? opts.employeeOptions : undefined} defaultEmployeeId={ctx.employee?.id ?? null}
            defaultProjectId={project ?? undefined} defaultOpen={one(sp.new) === "1"} />
        )} />

      {seesOthers && pending > 0 && status !== "submitted" && (
        <Link href={tabHref("submitted")}
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-sm font-medium text-amber hover:bg-amber/15 animate-fade-up">
          <Hourglass className="h-4 w-4" /> {ctx.t("expenses.pendingBanner", { n: pending })}
        </Link>
      )}

      <TabNav active={status ?? "all"} items={[
        { key: "all", label: ctx.t("common.all"), href: tabHref(null) },
        ...STATUSES.map((s) => ({
          key: s, href: tabHref(s), count: s === "submitted" ? pending : null,
          label: s === "submitted" ? ctx.t("expenses.pending") : ctx.label("expenses.status", s),
        })),
      ]} />

      <section aria-label={ctx.t("expenses.totals")} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {currencies.length === 0 ? (
          <Card className="p-4 text-sm text-muted sm:col-span-2 xl:col-span-3">{ctx.t("expenses.totalsEmpty")}</Card>
        ) : currencies.map(([cur, a]) => (
          <Card key={cur} className="relative overflow-hidden p-4 animate-fade-up">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-wood-500/30 to-transparent opacity-60 blur-xl" />
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("expenses.totalIn", { currency: cur })}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-wood-300"><Wallet className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 font-display text-[30px] font-bold leading-none tabular text-ink">{fmtMoney(a.total, cur)}</div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-muted">{ctx.t("expenses.pending")}</dt><dd className="tabular text-warn">{fmtMoney(a.pending, cur)}</dd></div>
              <div><dt className="text-muted">{ctx.label("expenses.status", "approved")}</dt><dd className="tabular text-ok">{fmtMoney(a.approved, cur)}</dd></div>
              <div><dt className="text-muted">{ctx.label("expenses.status", "paid")}</dt><dd className="tabular text-ink-2">{fmtMoney(a.paid, cur)}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-faint">{ctx.t("expenses.recordsCount", { n: a.count })}</p>
          </Card>
        ))}
      </section>

      <FilterBar filters={filters} />
      <ExpenseTable rows={rows} tr={ctx} />
      <Pagination page={page} pageSize={PAGE} total={rowsRes.count ?? 0} hrefFor={(p) => `/expenses${searchParamsToString(sp, { page: String(p), new: null })}`} />
      <p className="mt-3 text-xs text-faint">{ctx.t("expenses.currencyNote")}</p>
    </>
  );
}
