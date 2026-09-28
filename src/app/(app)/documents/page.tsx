import type { Metadata } from "next";
import { FileText, Paperclip, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { expiryBucket } from "@/components/shared/lists";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg } from "@/lib/context";
import { addDays, fmtDate, todayIn } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one, statusTone } from "@/lib/utils";
import { NewDocumentDialog } from "./components";
import { entityNames, expiryRange } from "./data";

export const metadata: Metadata = { title: "Dokumenti" };
const PAGE = 30;
const ENTITY_TYPES = ["employee", "machine", "project", "organization"] as const;
const ALL_ENTITY_TYPES = ["employee", "machine", "project", "organization", "safety_rule", "repair", "expense", "incident"] as const;
const BUCKETS = ["expired", "d7", "d14", "d30", "d60", "d90", "ok"] as const;

type Row = {
  id: string; name: string; document_type: string; entity_type: string; entity_id: string | null; expiry_date: string | null;
  version: number; status: string; file_id: string | null; uploaded_at: string; is_demo: boolean;
};

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const docParam = one(sp.doc);
  if (docParam && /^[0-9a-f-]{36}$/i.test(docParam)) redirect(`/documents/${docParam}`);

  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const entity = one(sp.entity);
  const type = one(sp.type);
  const expiry = one(sp.expiry);
  const canManage = ctx.can("manage_documents");
  const status = canManage ? one(sp.status) ?? "active" : "active";
  const today = todayIn(ctx.timezone);
  const opts = await getOptions(ctx);
  const typeLabel = new Map(opts.documentTypes.map((d) => [d.value, d.label]));

  let query = ctx.supabase.from("documents")
    .select("id, name, document_type, entity_type, entity_id, expiry_date, version, status, file_id, uploaded_at, is_demo", { count: "exact" })
    .eq("organization_id", ctx.org.id)
    .order("expiry_date", { ascending: true, nullsFirst: false }).order("uploaded_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status !== "all") query = query.eq("status", status);
  const term = likeTerm(q);
  if (term) query = query.or(`name.ilike.${term},notes.ilike.${term}`);
  if (entity && (ALL_ENTITY_TYPES as readonly string[]).includes(entity)) query = query.eq("entity_type", entity);
  if (type) query = query.eq("document_type", type);
  const range = expiryRange(expiry, today, addDays);
  if (range?.none) query = query.is("expiry_date", null);
  if (range?.lt) query = query.lt("expiry_date", range.lt);
  if (range?.gte) query = query.gte("expiry_date", range.gte);
  if (range?.lte) query = query.lte("expiry_date", range.lte);
  if (range?.gt) query = query.gt("expiry_date", range.gt);

  const [listRes, expiredRes, soonRes] = await Promise.all([
    query,
    ctx.supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("status", "active").lt("expiry_date", today),
    ctx.supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("status", "active").gte("expiry_date", today).lte("expiry_date", addDays(today, 30)),
  ]);
  const rows = (listRes.data ?? []) as Row[];
  const nameOf = await entityNames(ctx, rows.map((r) => ({ type: r.entity_type, id: r.entity_id })));
  const expiredCount = expiredRes.count ?? 0;
  const soonCount = soonRes.count ?? 0;

  const initialEntityType = (ENTITY_TYPES as readonly string[]).includes(one(sp.entity_type) ?? "") ? (one(sp.entity_type) as (typeof ENTITY_TYPES)[number]) : undefined;
  const newDialog = (defaultOpen?: boolean) => (
    <NewDocumentDialog orgId={ctx.org.id} documentTypes={opts.documentTypes}
      entities={{ employee: opts.employeeOptions, machine: opts.machineOptions, project: opts.allProjectOptions }}
      defaultOpen={defaultOpen} initialEntityType={initialEntityType} initialEntityId={one(sp.entity_id)} />
  );

  const filters: FilterDef[] = [
    { type: "search", name: "q" },
    { type: "select", name: "entity", label: ctx.t("documents.belongsTo"), options: ALL_ENTITY_TYPES.map((k) => ({ value: k, label: ctx.label("documents.entityTypes", k) })) },
    { type: "select", name: "type", label: ctx.t("documents.documentType"), options: opts.documentTypes },
    { type: "select", name: "expiry", label: ctx.t("documents.expiryFilter"), options: [
      ...BUCKETS.map((b) => ({ value: b, label: ctx.label("documents.expiring", b) })),
      { value: "none", label: ctx.t("documents.noExpiry") },
    ] },
    ...(canManage ? [{ type: "select" as const, name: "status", label: ctx.t("common.status"), options: [
      ...["archived", "superseded"].map((s) => ({ value: s, label: ctx.label("documents.status", s) })),
      { value: "all", label: ctx.t("common.all") },
    ] }] : []),
  ];

  return (
    <>
      <PageHeader title={ctx.t("documents.title")}
        subtitle={<>{ctx.t("documents.subtitle")}{listRes.count != null && <> · <span className="tabular text-ink-2">{listRes.count}</span></>}</>}
        actions={canManage && newDialog(one(sp.new) === "1")} />

      {(expiredCount > 0 || soonCount > 0) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 animate-fade-up">
          {expiredCount > 0 && (
            <Link href={`/documents${searchParamsToString({}, { expiry: "expired" })}`} className="flex items-center gap-3 rounded-xl border border-crit/30 bg-crit/10 px-4 py-3 text-sm text-crit transition hover:bg-crit/15">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              <span className="font-medium">{ctx.t("documents.expiredBanner", { n: expiredCount })}</span>
            </Link>
          )}
          {soonCount > 0 && (
            <Link href={`/documents${searchParamsToString({}, { expiry: "d30" })}`} className="flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn transition hover:bg-warn/15">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              <span className="font-medium">{ctx.t("documents.expiringBanner", { n: soonCount })}</span>
            </Link>
          )}
        </div>
      )}

      <FilterBar filters={filters} />
      <DataTable rows={rows} rowKey={(r) => r.id} href={(r) => `/documents/${r.id}`}
        empty={<EmptyState icon={<FileText className="h-6 w-6" />} title={ctx.t("documents.empty")} action={canManage ? newDialog() : undefined} />}
        columns={[
          { key: "n", header: ctx.t("common.name"), cell: (r) => (
            <span className="inline-flex items-center gap-2">
              {r.file_id ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-moss" aria-label={ctx.t("common.file")} /> : <FileText className="h-3.5 w-3.5 shrink-0 text-faint" aria-label={ctx.t("documents.noFile")} />}
              <span className="line-clamp-1">{r.name}</span>
              {r.is_demo && <DemoBadge />}
            </span>
          ) },
          { key: "t", header: ctx.t("documents.documentType"), cell: (r) => typeLabel.get(r.document_type) ?? r.document_type },
          { key: "b", header: ctx.t("documents.belongsTo"), cell: (r) => {
            const ent = nameOf({ type: r.entity_type, id: r.entity_id });
            return (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="text-xs text-muted">{ctx.label("documents.entityTypes", r.entity_type)}:</span>
                {ent.href ? <Link href={ent.href} className="truncate hover:text-amber">{ent.name}</Link> : <span className="truncate">{ent.name}</span>}
              </span>
            );
          }, hideOnMobile: true },
          { key: "e", header: ctx.t("documents.expiry"), cell: (r) => {
            if (!r.expiry_date) return <span className="text-muted">—</span>;
            const b = expiryBucket(r.expiry_date);
            return <span className="inline-flex items-center gap-2">{fmtDate(r.expiry_date)} <Badge tone={b.tone} dot={b.key === "expired" || b.key === "d7"}>{ctx.label("documents.expiring", b.key)}</Badge></span>;
          } },
          { key: "v", header: ctx.t("documents.version"), cell: (r) => <span className="tabular">v{r.version}</span>, hideOnMobile: true, align: "center" },
          ...(status !== "active" ? [{ key: "s", header: ctx.t("common.status"), cell: (r: Row) => <Badge tone={r.status === "active" ? "ok" : statusTone(r.status)}>{ctx.label("documents.status", r.status)}</Badge> }] : []),
        ]} />
      <Pagination page={page} pageSize={PAGE} total={listRes.count ?? 0} hrefFor={(p) => `/documents${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
