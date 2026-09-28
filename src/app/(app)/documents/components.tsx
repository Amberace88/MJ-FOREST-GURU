"use client";

import { CheckCircle2, FilePlus2, Layers, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileUploader } from "@/components/shared/file-uploader";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { attachDocumentFile, createDocument, newDocumentVersion, updateDocument } from "./actions";

export const DOC_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx,.txt";
const ENTITY_TYPES = ["employee", "machine", "project", "organization"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];
const VISIBILITY = ["management", "entity", "organization"] as const;

export type EntityOptions = { employee: Option[]; machine: Option[]; project: Option[] };

/** Upload slot: uploads to the private `documents` bucket, keeps the new file id in a hidden input. */
function FileSlot({ orgId, entityType, entityId, name = "file_id" }: { orgId: string; entityType: EntityType; entityId: string | null; name?: string }) {
  const { t } = useT();
  const [fileId, setFileId] = useState<string | null>(null);
  const ready = entityType === "organization" || Boolean(entityId);
  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {t("common.file")} <span className="normal-case tracking-normal text-faint">({t("common.optional")})</span>
      </span>
      {fileId && <input type="hidden" name={name} value={fileId} />}
      {ready ? (
        fileId ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm text-ok">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {t("documents.fileAttached")}</span>
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setFileId(null)}>{t("common.clear")}</button>
          </div>
        ) : (
          <FileUploader key={`${entityType}-${entityId}`} orgId={orgId} entityType={entityType} entityId={entityType === "organization" ? orgId : entityId}
            bucket="documents" kind="document" accept={DOC_ACCEPT} multiple={false} label={t("documents.attachFile")}
            onUploaded={(ids) => setFileId(ids[ids.length - 1] ?? null)} />
        )
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-xs text-muted">{t("documents.chooseEntityFirst")}</p>
      )}
    </div>
  );
}

function DatesAndVisibility({ values, withVisibility = true }: { values?: DocValues; withVisibility?: boolean }) {
  const { t, label } = useT();
  return (
    <FormGrid cols={withVisibility ? 3 : 2}>
      <Input name="issued_at" type="date" label={t("documents.issued")} defaultValue={values?.issued_at ?? ""} optional />
      <Input name="expiry_date" type="date" label={t("documents.expiry")} defaultValue={values?.expiry_date ?? ""} optional />
      {withVisibility && (
        <Select name="visibility" label={t("documents.visibility")} defaultValue={values?.visibility ?? "management"}
          options={VISIBILITY.map((v) => ({ value: v, label: label("documents.visibilityOptions", v) }))} />
      )}
    </FormGrid>
  );
}

export type DocValues = { id?: string; name?: string; document_type?: string; issued_at?: string | null; expiry_date?: string | null; visibility?: string; notes?: string | null };

function NewDocumentFields({ orgId, entities, documentTypes, initialEntityType, initialEntityId }: {
  orgId: string; entities: EntityOptions; documentTypes: Option[]; initialEntityType?: EntityType; initialEntityId?: string;
}) {
  const { t, label } = useT();
  const [entityType, setEntityType] = useState<EntityType>(initialEntityType ?? "employee");
  const [entityId, setEntityId] = useState<string>(initialEntityId ?? "");
  const entityOpts = entityType === "organization" ? [] : entities[entityType];
  return (
    <div className="space-y-4">
      <FormGrid>
        <Select name="entity_type" label={t("documents.belongsTo")} value={entityType}
          onChange={(e) => { setEntityType(e.target.value as EntityType); setEntityId(""); }}
          options={ENTITY_TYPES.map((k) => ({ value: k, label: label("documents.entityTypes", k) }))} />
        {entityType !== "organization" ? (
          <Select name="entity_id" label={t("documents.entity")} value={entityId} onChange={(e) => setEntityId(e.target.value)} options={entityOpts} placeholder="" required />
        ) : <div className="hidden sm:block" />}
      </FormGrid>
      <FormGrid>
        <Input name="name" label={t("common.name")} required maxLength={200} />
        <Select name="document_type" label={t("documents.documentType")} defaultValue={documentTypes[0]?.value ?? "other"}
          options={documentTypes.length ? documentTypes : [{ value: "other", label: "other" }]} />
      </FormGrid>
      <DatesAndVisibility />
      <FileSlot orgId={orgId} entityType={entityType} entityId={entityId || null} />
      <Textarea name="notes" label={t("common.notes")} optional maxLength={4000} />
    </div>
  );
}

export function NewDocumentDialog(props: {
  orgId: string; entities: EntityOptions; documentTypes: Option[]; defaultOpen?: boolean; initialEntityType?: EntityType; initialEntityId?: string;
}) {
  const { t } = useT();
  const { defaultOpen, ...rest } = props;
  return (
    <FormDialog size="lg" title={t("documents.new")} action={createDocument as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><FilePlus2 className="h-4 w-4" /> {t("documents.new")}</Button>}>
      <NewDocumentFields {...rest} />
    </FormDialog>
  );
}

export function EditDocumentDialog({ values, documentTypes }: { values: DocValues & { id: string }; documentTypes: Option[] }) {
  const { t } = useT();
  const types = documentTypes.some((d) => d.value === values.document_type) || !values.document_type
    ? documentTypes : [...documentTypes, { value: values.document_type, label: values.document_type }];
  return (
    <FormDialog size="lg" title={`${t("common.edit")}: ${values.name ?? ""}`} action={updateDocument.bind(null, values.id) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <div className="space-y-4">
        <FormGrid>
          <Input name="name" label={t("common.name")} defaultValue={values.name} required maxLength={200} />
          <Select name="document_type" label={t("documents.documentType")} defaultValue={values.document_type} options={types} />
        </FormGrid>
        <DatesAndVisibility values={values} />
        <Textarea name="notes" label={t("common.notes")} defaultValue={values.notes ?? ""} optional maxLength={4000} />
      </div>
    </FormDialog>
  );
}

export function NewVersionDialog({ id, orgId, entityType, entityId, version }: { id: string; orgId: string; entityType: EntityType; entityId: string | null; version: number }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={`${t("documents.newVersion")} · v${version + 1}`} description={t("documents.newVersionHint")}
      action={newDocumentVersion.bind(null, id) as FormAction}
      trigger={<Button variant="amber"><Layers className="h-4 w-4" /> {t("documents.newVersion")}</Button>}>
      <div className="space-y-4">
        <DatesAndVisibility withVisibility={false} />
        <FileSlot orgId={orgId} entityType={entityType} entityId={entityId} />
        <Textarea name="notes" label={t("common.notes")} optional maxLength={4000} />
      </div>
    </FormDialog>
  );
}

/** Attach or replace the file of an existing document. */
export function AttachFile({ id, orgId, entityType, entityId, replace }: { id: string; orgId: string; entityType: EntityType; entityId: string | null; replace?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <FileUploader orgId={orgId} entityType={entityType} entityId={entityType === "organization" ? orgId : entityId} bucket="documents" kind="document"
      accept={DOC_ACCEPT} multiple={false} compact={replace} label={replace ? t("documents.replaceFile") : t("documents.attachFile")}
      onUploaded={(ids) => {
        const fileId = ids[ids.length - 1];
        if (!fileId) return;
        start(async () => {
          const res = await attachDocumentFile(id, fileId);
          if (!res.ok) toast(res.error, "error");
          router.refresh();
        });
      }} />
  );
}
