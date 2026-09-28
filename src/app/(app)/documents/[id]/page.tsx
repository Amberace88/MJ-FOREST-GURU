import type { Metadata } from "next";
import { Archive, ArchiveRestore, Download, ExternalLink, FileText, History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { expiryBucket } from "@/components/shared/lists";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg } from "@/lib/context";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { statusTone } from "@/lib/utils";
import { archiveDocument, restoreDocument } from "../actions";
import { AttachFile, EditDocumentDialog, NewVersionDialog } from "../components";
import { entityNames, signedFileUrl } from "../data";

export const metadata: Metadata = { title: "Dokuments" };

type EntityType = "employee" | "machine" | "project" | "organization";
const UPLOADABLE: readonly string[] = ["employee", "machine", "project", "organization"];

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const { data: doc } = await ctx.supabase.from("documents").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!doc) notFound();

  const canManage = ctx.can("manage_documents");
  let historyQuery = ctx.supabase.from("documents").select("id, version, status, issued_at, expiry_date, uploaded_at, file_id")
    .eq("organization_id", ctx.org.id).eq("entity_type", doc.entity_type).eq("document_type", doc.document_type).eq("name", doc.name)
    .order("version", { ascending: false }).limit(50);
  historyQuery = doc.entity_id ? historyQuery.eq("entity_id", doc.entity_id) : historyQuery.is("entity_id", null);

  const [opts, file, nameOf, historyRes, uploaderRes] = await Promise.all([
    getOptions(ctx),
    signedFileUrl(ctx, doc.file_id),
    entityNames(ctx, [{ type: doc.entity_type, id: doc.entity_id }]),
    historyQuery,
    doc.uploaded_by ? ctx.supabase.from("profiles").select("full_name, email").eq("id", doc.uploaded_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const typeLabel = opts.documentTypes.find((d) => d.value === doc.document_type)?.label ?? doc.document_type;
  const owner = nameOf({ type: doc.entity_type, id: doc.entity_id });
  const bucket = expiryBucket(doc.expiry_date);
  const history = historyRes.data ?? [];
  const uploader = uploaderRes.data as { full_name: string | null; email: string | null } | null;
  const uploadable = UPLOADABLE.includes(doc.entity_type);
  const entityType = doc.entity_type as EntityType;
  const daysLeft = doc.expiry_date ? Math.floor((new Date(`${doc.expiry_date}T12:00:00Z`).getTime() - Date.now()) / 86_400_000) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/documents", label: ctx.t("documents.title") }}
        eyebrow={<><span>{typeLabel}</span><span>· v{doc.version}</span>{doc.is_demo && <DemoBadge />}</>}
        title={doc.name}
        subtitle={<>{ctx.label("documents.entityTypes", doc.entity_type)}: {owner.href ? <Link href={owner.href} className="text-ink-2 hover:text-amber">{owner.name}</Link> : owner.name}</>}
        actions={<>
          <Badge tone={doc.status === "active" ? "ok" : statusTone(doc.status)} className="px-3 py-1 text-xs">{ctx.label("documents.status", doc.status)}</Badge>
          {canManage && doc.status === "active" && <EditDocumentDialog documentTypes={opts.documentTypes} values={{ ...doc, id }} />}
          {canManage && doc.status === "active" && uploadable && <NewVersionDialog id={id} orgId={ctx.org.id} entityType={entityType} entityId={doc.entity_id} version={Math.max(doc.version, ...history.map((h) => h.version))} />}
          {canManage && doc.status === "active" && (
            <ActionButton action={archiveDocument.bind(null, id)} variant="ghost" confirm={ctx.t("documents.archiveConfirm")}><Archive className="h-4 w-4" /> {ctx.t("common.archive")}</ActionButton>
          )}
          {canManage && doc.status === "archived" && (
            <ActionButton action={restoreDocument.bind(null, id)} variant="secondary"><ArchiveRestore className="h-4 w-4" /> {ctx.t("common.restore")}</ActionButton>
          )}
        </>}
      />

      {doc.expiry_date && ["expired", "d7", "d14", "d30"].includes(bucket.key) && doc.status === "active" && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${bucket.tone === "crit" ? "border-crit/30 bg-crit/10 text-crit" : "border-warn/30 bg-warn/10 text-warn"}`}>
          {ctx.label("documents.expiring", bucket.key)} · {fmtDate(doc.expiry_date)} · {daysLeft !== null && (daysLeft < 0 ? ctx.t("documents.daysAgo", { n: Math.abs(daysLeft) }) : ctx.t("documents.daysLeft", { n: daysLeft }))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("documents.detail")} icon={<FileText className="h-4 w-4" />} />
            <CardBody>
              <DefinitionList items={[
                { label: ctx.t("documents.documentType"), value: typeLabel },
                { label: ctx.t("documents.belongsTo"), value: `${ctx.label("documents.entityTypes", doc.entity_type)} · ${owner.name}` },
                { label: ctx.t("documents.issued"), value: fmtDate(doc.issued_at) },
                { label: ctx.t("documents.expiry"), value: doc.expiry_date ? <span className="inline-flex items-center gap-2">{fmtDate(doc.expiry_date)} <Badge tone={bucket.tone}>{ctx.label("documents.expiring", bucket.key)}</Badge></span> : ctx.t("documents.noExpiry") },
                { label: ctx.t("documents.version"), value: `v${doc.version}` },
                { label: ctx.t("documents.visibility"), value: ctx.label("documents.visibilityOptions", doc.visibility) },
                { label: ctx.t("documents.uploadedBy"), value: uploader?.full_name ?? uploader?.email ?? null },
                { label: ctx.t("documents.uploadedAt"), value: fmtDateTime(doc.uploaded_at, ctx.timezone) },
              ]} />
              {doc.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-ink-2">{doc.notes}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={ctx.t("documents.versions")} icon={<History className="h-4 w-4" />} />
            <CardBody>
              <DataTable rows={history} rowKey={(h) => h.id} href={(h) => `/documents/${h.id}`}
                empty={<p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
                columns={[
                  { key: "v", header: ctx.t("documents.version"), cell: (h) => <span className="tabular">v{h.version}{h.id === id && <span className="ml-2 text-xs text-amber">●</span>}</span> },
                  { key: "s", header: ctx.t("common.status"), cell: (h) => <Badge tone={h.status === "active" ? "ok" : statusTone(h.status)}>{h.status === "active" ? ctx.t("documents.current") : ctx.label("documents.status", h.status)}</Badge> },
                  { key: "i", header: ctx.t("documents.issued"), cell: (h) => fmtDate(h.issued_at), hideOnMobile: true },
                  { key: "e", header: ctx.t("documents.expiry"), cell: (h) => fmtDate(h.expiry_date) },
                  { key: "u", header: ctx.t("documents.uploadedAt"), cell: (h) => fmtDate(h.uploaded_at, ctx.timezone), hideOnMobile: true },
                ]} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={ctx.t("common.file")} />
            <CardBody className="space-y-3">
              {file ? (
                <>
                  {file.mime?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={file.name ?? doc.name} className="max-h-80 w-full rounded-xl border border-line object-contain" />
                  ) : (
                    <div className="grid place-items-center rounded-xl border border-line bg-surface-2/40 px-4 py-8 text-center">
                      <FileText className="mb-2 h-8 w-8 text-moss" />
                      <span className="line-clamp-2 text-sm text-ink-2">{file.name ?? doc.name}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 text-sm hover:bg-surface-3">
                      <ExternalLink className="h-4 w-4" /> {ctx.t("documents.openFile")}
                    </a>
                    <a href={file.url} download={file.name ?? undefined} className="inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm text-ink-2 hover:bg-surface-2">
                      <Download className="h-4 w-4" /> {ctx.t("common.download")}
                    </a>
                  </div>
                  {canManage && doc.status === "active" && uploadable && <AttachFile id={id} orgId={ctx.org.id} entityType={entityType} entityId={doc.entity_id} replace />}
                </>
              ) : (
                <>
                  <EmptyState title={ctx.t("documents.noFile")} className="py-8" />
                  {canManage && doc.status === "active" && uploadable && <AttachFile id={id} orgId={ctx.org.id} entityType={entityType} entityId={doc.entity_id} />}
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={ctx.t("common.activity")} />
            <CardBody><Activity ctx={ctx} entity="documents" entityId={id} limit={20} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
