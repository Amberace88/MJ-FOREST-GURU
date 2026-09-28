"use client";

import { Camera, FileText, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { registerFile } from "@/app/(app)/common-actions";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { compressImage } from "@/lib/offline/queue";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createReceiptRecord } from "./actions";
import type { ReceiptOcr } from "./types";

const MAX = 20 * 1024 * 1024; // receipts bucket limit
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export type UploadedReceipt = { receiptId: string; fileId: string; ocr: ReceiptOcr | null; previewUrl: string | null; name: string };

/**
 * Uploads a receipt photo straight to the PRIVATE `receipts` bucket
 * (`{org}/receipt/{receiptId}/{uuid}.{ext}`), registers it in `files`, then
 * creates the unconfirmed receipt row server-side.
 */
export function useReceiptUpload(orgId: string) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  async function upload(file: File): Promise<UploadedReceipt | null> {
    if (file.size > MAX) { toast(t("errors.fileTooLarge"), "error"); return null; }
    if (file.type && !ALLOWED.includes(file.type)) { toast(t("errors.fileType"), "error"); return null; }
    setBusy(true);
    try {
      const sb = getBrowserClient();
      const receiptId = crypto.randomUUID();
      const blob = await compressImage(file);
      const compressed = blob !== file && blob.type === "image/jpeg";
      const ext = (compressed ? "jpg" : file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const path = `${orgId}/receipt/${receiptId}/${crypto.randomUUID()}.${ext}`;
      const mime = blob.type || file.type || "application/octet-stream";
      const { error } = await sb.storage.from("receipts").upload(path, blob, { contentType: mime, upsert: false });
      if (error) { toast(/mime|type/i.test(error.message) ? t("errors.fileType") : t("errors.generic"), "error"); return null; }
      const reg = await registerFile({ bucket: "receipts", path, entityType: "receipt", entityId: receiptId, kind: "receipt", originalName: file.name.slice(0, 255), mimeType: mime, size: blob.size });
      if (!reg.ok || !reg.data) { toast(reg.ok ? t("errors.generic") : reg.error, "error"); return null; }
      const rec = await createReceiptRecord({ receiptId, fileId: reg.data.id });
      if (!rec.ok || !rec.data) { toast(rec.ok ? t("errors.generic") : rec.error, "error"); return null; }
      return { receiptId, fileId: reg.data.id, ocr: rec.data.ocr, previewUrl: mime.startsWith("image/") && mime !== "image/heic" ? URL.createObjectURL(blob) : null, name: file.name };
    } catch {
      toast(t("errors.generic"), "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { upload, busy };
}

/** Two large touch targets: camera (capture="environment") and file picker. */
export function ReceiptCaptureButtons({ orgId, onUploaded, compact }: { orgId: string; onUploaded: (r: UploadedReceipt) => void; compact?: boolean }) {
  const { t } = useT();
  const { upload, busy } = useReceiptUpload(orgId);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function handle(files: FileList | null, input: HTMLInputElement | null) {
    const file = files?.[0];
    if (!file) return;
    const res = await upload(file);
    if (input) input.value = "";
    if (res) onUploaded(res);
  }

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
        aria-label={t("receipts.takePhoto")} onChange={(e) => handle(e.target.files, e.currentTarget)} />
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="sr-only" tabIndex={-1}
        aria-label={t("receipts.chooseFile")} onChange={(e) => handle(e.target.files, e.currentTarget)} />
      <button type="button" disabled={busy} onClick={() => camera.current?.click()}
        className={cn("flex items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 font-medium text-amber transition hover:bg-amber/15 disabled:opacity-60",
          compact ? "h-11 px-3 text-sm" : "h-28 flex-col text-base")}>
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className={compact ? "h-4 w-4" : "h-7 w-7"} />}
        <span>{busy ? t("common.uploading") : t("receipts.takePhoto")}</span>
      </button>
      <button type="button" disabled={busy} onClick={() => picker.current?.click()}
        className={cn("flex items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-ink-2 transition hover:border-forest-400 hover:bg-forest-800/30 hover:text-ink disabled:opacity-60",
          compact ? "h-11 px-3 text-sm" : "h-28 flex-col text-base")}>
        <Upload className={compact ? "h-4 w-4 text-moss" : "h-6 w-6 text-moss"} />
        <span>{t("receipts.chooseFile")}</span>
      </button>
    </div>
  );
}

/**
 * Form field for the expense dialog: uploads a receipt photo and puts the
 * resulting receipt id into a hidden `receipt_id` input.
 */
export function ReceiptPhotoField({ orgId, name = "receipt_id", existing }: { orgId: string; name?: string; existing?: { id: string; url: string | null; label: string } | null }) {
  const { t } = useT();
  const [current, setCurrent] = useState<{ id: string; url: string | null; label: string } | null>(existing ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
        {t("expenses.receipt")} <span className="normal-case tracking-normal text-faint">({t("common.optional")})</span>
      </span>
      <input type="hidden" name={name} value={current?.id ?? ""} />
      {current ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-2.5">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-3">
            {current.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={t("expenses.receipt")} className="h-full w-full object-cover" />
            ) : <FileText className="h-6 w-6 text-moss" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{current.label}</span>
          <button type="button" onClick={() => { setCurrent(null); setObjectUrl(null); }}
            className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-ink" aria-label={t("receipts.removeFromExpense")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <ReceiptCaptureButtons orgId={orgId} compact onUploaded={(r) => {
          setObjectUrl(r.previewUrl);
          setCurrent({ id: r.receiptId, url: r.previewUrl, label: r.name });
        }} />
      )}
    </div>
  );
}
