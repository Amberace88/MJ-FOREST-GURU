import type { Metadata } from "next";
import { Archive, CheckCircle2, CircleDashed, ExternalLink, FileText, Fuel, ImageOff, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { ActionButton } from "@/components/ui/form";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { requirePermission, type OrgContext } from "@/lib/context";
import { addDays, fmtDate, fmtDateTime, fmtMoney, fmtNumber, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { archiveReceipt } from "./actions";
import { AddReceiptDialog, ReceiptConfirmForm } from "./components";
import { RoutedDialog } from "./routed-dialog";
import { defaultCurrency, receiptFormOptions } from "./options";
import { CURRENCIES, parseOcr } from "./types";

export const metadata: Metadata = { title: "Čeki" };
const PAGE = 24;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type SP = Record<string, string | string[] | undefined>;
type FileRel = { id: string; bucket: string; path: string; mime_type: string | null } | null;

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requirePermission("create_expense", "view_finance", "approve_expense", "view_fuel");
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const status = one(sp.status);
  const currency = one(sp.currency);
  const employee = one(sp.employee);
  const from = one(sp.from);
  const to = one(sp.to);
  const receiptId = one(sp.receipt);
  const seesOthers = ctx.canAny("view_finance", "approve_expense", "view_fuel");

  let query = ctx.supabase.from("receipts")
    .select("id, merchant, receipt_date, amount, vat_amount, currency, ocr_confirmed, created_at, is_demo, file:files(id, bucket, path, mime_type), employee:employees(id, full_name)", { count: "exact" })
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const term = likeTerm(q);
  if (term) query = query.ilike("merchant", term);
  if (status === "confirmed") query = query.eq("ocr_confirmed", true);
  if (status === "unconfirmed") query = query.eq("ocr_confirmed", false);
  if (currency && (CURRENCIES as readonly string[]).includes(currency)) query = query.eq("currency", currency);
  if (employee && seesOthers) query = query.eq("employee_id", employee);
  if (from && DATE_RE.test(from)) query = query.gte("created_at", zonedMidnightUtc(from, ctx.timezone).toISOString());
  if (to && DATE_RE.test(to)) query = query.lt("created_at", zonedMidnightUtc(addDays(to, 1), ctx.timezone).toISOString());

  const [{ data, count }, unconfirmedRes, opts] = await Promise.all([
    query,
    ctx.supabase.from("receipts").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).is("deleted_at", null).eq("ocr_confirmed", false),
    getOptions(ctx),
  ]);
  const rows = (data ?? []).map((r) => ({ ...r, file: r.file as unknown as FileRel, employee: r.employee as unknown as { id: string; full_name: string } | null }));
  const urls = await signedUrls(ctx, rows.map((r) => r.file));
  const unconfirmed = unconfirmedRes.count ?? 0;
  const listHref = `/receipts${searchParamsToString(sp, { receipt: null, new: null })}`;

  return (
    <>
      <PageHeader title={ctx.t("receipts.title")} subtitle={ctx.t("receipts.subtitle")}
        actions={<AddReceiptDialog orgId={ctx.org.id} defaultOpen={one(sp.new) === "1"} />} />

      {unconfirmed > 0 && status !== "unconfirmed" && (
        <Link href={`/receipts${searchParamsToString(sp, { status: "unconfirmed", page: null, receipt: null })}`}
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-sm font-medium text-amber hover:bg-amber/15 animate-fade-up">
          <CircleDashed className="h-4 w-4" /> {ctx.t("receipts.unconfirmedCount", { n: unconfirmed })}
        </Link>
      )}

      <FilterBar filters={[
        { type: "search", name: "q", placeholder: ctx.t("receipts.searchMerchant") },
        { type: "select", name: "status", label: ctx.t("common.status"), options: [
          { value: "unconfirmed", label: ctx.t("receipts.unconfirmed") }, { value: "confirmed", label: ctx.t("receipts.confirmed") },
        ] },
        { type: "select", name: "currency", label: ctx.t("common.currency"), options: CURRENCIES.map((c) => ({ value: c, label: c })) },
        ...(seesOthers ? [{ type: "select" as const, name: "employee", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
        { type: "date", name: "from", label: ctx.t("common.from") },
        { type: "date", name: "to", label: ctx.t("common.to") },
      ]} />

      {rows.length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title={ctx.t("receipts.empty")} text={ctx.t("receipts.emptyHint")}
          action={<AddReceiptDialog orgId={ctx.org.id} />} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {rows.map((r, i) => {
            const url = r.file ? urls.get(r.file.path) ?? null : null;
            const isImg = r.file?.mime_type?.startsWith("image/") && r.file.mime_type !== "image/heic";
            return (
              <li key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <Link href={`/receipts${searchParamsToString(sp, { receipt: r.id, new: null })}`} scroll={false}
                  className="card card-hover group block h-full overflow-hidden">
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                    {url && isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={r.merchant ?? ctx.t("expenses.receipt")} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted">
                        {r.file ? <FileText className="h-10 w-10 text-moss" /> : <ImageOff className="h-8 w-8" />}
                      </span>
                    )}
                    <span className="absolute left-2 top-2 flex gap-1">
                      <Badge tone={r.ocr_confirmed ? "ok" : "warn"} dot>{r.ocr_confirmed ? ctx.t("receipts.confirmed") : ctx.t("receipts.unconfirmed")}</Badge>
                    </span>
                    {r.is_demo && <span className="absolute right-2 top-2"><DemoBadge /></span>}
                  </div>
                  <div className="space-y-0.5 p-3">
                    <div className="truncate text-sm font-medium text-ink">{r.merchant ?? "—"}</div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted">{r.receipt_date ? fmtDate(r.receipt_date) : fmtDate(r.created_at, ctx.timezone)}</span>
                      <span className="font-semibold tabular text-ink">{r.amount != null && r.currency ? fmtMoney(r.amount, r.currency) : "—"}</span>
                    </div>
                    {seesOthers && r.employee && <div className="truncate text-[11px] text-faint">{r.employee.full_name}</div>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/receipts${searchParamsToString(sp, { page: String(p), receipt: null })}`} />

      {receiptId && <ReceiptDetail key={receiptId} ctx={ctx} id={receiptId} closeHref={listHref} />}
    </>
  );
}

async function signedUrls(ctx: OrgContext, files: FileRel[]) {
  const paths = files.filter((f): f is NonNullable<FileRel> => Boolean(f && f.bucket === "receipts")).map((f) => f.path);
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await ctx.supabase.storage.from("receipts").createSignedUrls(paths, 60 * 60);
  for (const s of data ?? []) if (s.signedUrl && s.path) out.set(s.path, s.signedUrl);
  return out;
}

async function ReceiptDetail({ ctx, id, closeHref }: { ctx: OrgContext; id: string; closeHref: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: r } = await ctx.supabase.from("receipts")
    .select("id, merchant, receipt_date, amount, vat_amount, currency, ocr_raw, ocr_confirmed, uploaded_by, created_at, file:files(id, bucket, path, mime_type, original_name), employee:employees(id, full_name)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!r) {
    return (
      <RoutedDialog title={ctx.t("expenses.receipt")} closeHref={closeHref} size="md">
        <EmptyState title={ctx.t("errors.notFound")} />
      </RoutedDialog>
    );
  }
  const file = r.file as unknown as (NonNullable<FileRel> & { original_name: string | null }) | null;
  const employee = r.employee as unknown as { id: string; full_name: string } | null;
  const [urls, options, expensesRes, fuelRes, uploaderRes] = await Promise.all([
    signedUrls(ctx, [file]),
    receiptFormOptions(ctx),
    ctx.supabase.from("expenses").select("id, expense_date, amount, currency, category, status").eq("receipt_id", id).is("deleted_at", null).order("created_at"),
    ctx.supabase.from("fuel_logs").select("id, occurred_at, litres, total_amount, currency").eq("receipt_id", id).is("deleted_at", null).order("occurred_at"),
    ctx.supabase.from("profiles").select("full_name").eq("id", r.uploaded_by).maybeSingle(),
  ]);
  const url = file ? urls.get(file.path) ?? null : null;
  const isImg = file?.mime_type?.startsWith("image/") && file.mime_type !== "image/heic";
  const ocr = r.ocr_confirmed ? null : parseOcr(r.ocr_raw);
  const canEdit = r.uploaded_by === ctx.user.id || ctx.can("view_finance");

  return (
    <RoutedDialog size="xl" closeHref={closeHref}
      title={r.merchant ?? ctx.t("expenses.receipt")}
      description={<span className="flex flex-wrap items-center gap-2">
        <Badge tone={r.ocr_confirmed ? "ok" : "warn"} dot>{r.ocr_confirmed ? ctx.t("receipts.confirmed") : ctx.t("receipts.unconfirmed")}</Badge>
        <span>{ctx.t("receipts.uploadedBy", { name: uploaderRes.data?.full_name ?? employee?.full_name ?? "—", when: fmtDateTime(r.created_at, ctx.timezone) })}</span>
      </span>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
            {url && isImg ? (
              <a href={url} target="_blank" rel="noopener noreferrer" title={ctx.t("receipts.openOriginal")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={r.merchant ?? ctx.t("expenses.receipt")} className="max-h-[60vh] w-full object-contain" />
              </a>
            ) : (
              <div className="grid h-60 place-items-center text-muted">
                {file ? <FileText className="h-12 w-12 text-moss" /> : <ImageOff className="h-10 w-10" />}
              </div>
            )}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-amber hover:underline">
              <ExternalLink className="h-4 w-4" /> {ctx.t("receipts.openOriginal")}
            </a>
          )}
          {r.ocr_confirmed && (
            <DefinitionList items={[
              { label: ctx.t("receipts.merchant"), value: r.merchant },
              { label: ctx.t("common.date"), value: fmtDate(r.receipt_date) },
              { label: ctx.t("receipts.total"), value: r.amount != null && r.currency ? fmtMoney(r.amount, r.currency) : null },
              { label: ctx.t("receipts.vat"), value: r.vat_amount != null && r.currency ? fmtMoney(r.vat_amount, r.currency) : null },
            ]} />
          )}
        </div>
        <div className="space-y-5">
          <ReceiptConfirmForm receiptId={r.id} confirmed={r.ocr_confirmed} fromOcr={Boolean(ocr)} options={options} defaultCurrency={defaultCurrency(ctx)}
            canExpense={ctx.can("create_expense")} canFuel={Boolean(ctx.employee) || ctx.can("edit_fuel")} readOnly={!canEdit}
            defaults={{
              merchant: r.merchant ?? ocr?.merchant ?? null,
              date: r.receipt_date ?? ocr?.date ?? null,
              amount: r.amount ?? ocr?.total ?? null,
              vat: r.vat_amount ?? ocr?.vat ?? null,
              currency: r.currency ?? ocr?.currency ?? null,
            }} />

          <Card>
            <CardHeader title={ctx.t("receipts.linkedRecords")} />
            <CardBody>
              {(expensesRes.data ?? []).length + (fuelRes.data ?? []).length === 0 ? (
                <p className="text-sm text-muted">{ctx.t("receipts.noLinked")}</p>
              ) : (
                <ul className="divide-y divide-line/70 text-sm">
                  {(expensesRes.data ?? []).map((e) => (
                    <li key={e.id}>
                      <Link href={`/expenses/${e.id}`} className="flex items-center gap-3 py-2 hover:text-amber">
                        <Wallet className="h-4 w-4 text-moss" />
                        <span className="flex-1 truncate">{ctx.label("expenses.categories", e.category)} · {fmtDate(e.expense_date)}</span>
                        <span className="tabular">{fmtMoney(e.amount, e.currency)}</span>
                        <Badge tone={statusTone(e.status)}>{ctx.label("expenses.status", e.status)}</Badge>
                      </Link>
                    </li>
                  ))}
                  {(fuelRes.data ?? []).map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2">
                      <Fuel className="h-4 w-4 text-amber" />
                      <span className="flex-1 truncate">{ctx.t("nav.fuel")} · {fmtDate(f.occurred_at, ctx.timezone)}</span>
                      <span className="tabular">{fmtNumber(f.litres, 1)} L</span>
                      <span className="tabular text-muted">{fmtMoney(f.total_amount, f.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {canEdit && (
            <div className="flex justify-end">
              <ActionButton action={archiveReceipt.bind(null, r.id)} variant="ghost" confirm={`${ctx.t("common.archive")}?`}>
                <Archive className="h-4 w-4" /> {ctx.t("common.archive")}
              </ActionButton>
            </div>
          )}
          {!r.ocr_confirmed && !canEdit && (
            <p className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="h-3.5 w-3.5" /> {ctx.t("receipts.onlyUploaderConfirms")}</p>
          )}
        </div>
      </div>
    </RoutedDialog>
  );
}
