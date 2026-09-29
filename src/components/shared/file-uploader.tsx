"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { registerFile } from "@/app/(app)/common-actions";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { compressImage } from "@/lib/offline/queue";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Kind = "photo" | "video" | "before" | "after" | "receipt" | "document" | "avatar" | "other";
type EntityType = "employee" | "machine" | "project" | "organization" | "safety_rule" | "repair" | "expense" | "fuel" | "incident" | "task" | "production" | "receipt" | "contract";

const MAX = 50 * 1024 * 1024;

/**
 * Direct-to-storage upload from the browser (private bucket, RLS-checked path
 * `{org}/{entity}/{id}/{uuid}.{ext}`), then metadata registration server-side.
 */
export function FileUploader({ orgId, entityType, entityId, bucket = "media", kind = "photo", accept = "image/*", multiple = true, capture, label, compact, onUploaded }: {
  orgId: string; entityType: EntityType; entityId: string | null; bucket?: "media" | "documents" | "receipts"; kind?: Kind;
  accept?: string; multiple?: boolean; capture?: boolean; label?: string; compact?: boolean; onUploaded?: (fileIds: string[]) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const sb = getBrowserClient();
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX) { toast(t("errors.fileTooLarge"), "error"); continue; }
      const blob = await compressImage(file);
      const ext = (blob.type === "image/jpeg" && blob !== file ? "jpg" : file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${orgId}/${entityType}/${entityId ?? "general"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || file.type, upsert: false });
      if (error) { toast(/mime|type/i.test(error.message) ? t("errors.fileType") : t("errors.generic"), "error"); continue; }
      const res = await registerFile({ bucket, path, entityType, entityId, kind, originalName: file.name.slice(0, 255), mimeType: blob.type || file.type, size: blob.size });
      if (res.ok && res.data) ids.push(res.data.id);
      else if (!res.ok) toast(res.error, "error");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ids.length) { toast(t("common.success")); onUploaded?.(ids); router.refresh(); }
  }

  return (
    <>
      <input ref={input} type="file" className="sr-only" accept={accept} multiple={multiple} capture={capture ? "environment" : undefined}
        onChange={(e) => handle(e.target.files)} aria-label={label ?? t("common.upload")} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className={cn("inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-ink-2 transition hover:border-forest-400 hover:bg-forest-800/30 hover:text-ink disabled:opacity-60",
          compact ? "h-9 px-3" : "h-24 w-full flex-col")}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : capture ? <Camera className="h-5 w-5 text-moss" /> : <Upload className="h-5 w-5 text-moss" />}
        <span>{busy ? t("common.uploading") : label ?? t("common.upload")}</span>
      </button>
    </>
  );
}
