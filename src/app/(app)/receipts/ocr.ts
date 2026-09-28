import "server-only";
import type { OrgContext } from "@/lib/context";
import { logServerError } from "@/lib/errors";
import { parseOcr, type ReceiptOcr } from "./types";

/**
 * Optional receipt OCR adapter.
 *
 * No provider ships with the MVP. When `RECEIPT_OCR_ENDPOINT` is configured the
 * endpoint receives `{ url, mimeType }` (a 5-minute signed URL of the private
 * receipt object) and must answer `{ merchant?, date?, total?, vat?, currency? }`.
 * The result is stored in `receipts.ocr_raw` and only PREFILLS the confirmation
 * form — the user always has to confirm the values (`ocr_confirmed`).
 */
export function ocrConfigured() {
  return Boolean(process.env.RECEIPT_OCR_ENDPOINT);
}

export async function runReceiptOcr(ctx: OrgContext, file: { bucket: string; path: string; mime_type: string | null }): Promise<ReceiptOcr | null> {
  const endpoint = process.env.RECEIPT_OCR_ENDPOINT;
  if (!endpoint) return null;
  if (!file.mime_type || !(file.mime_type.startsWith("image/") || file.mime_type === "application/pdf")) return null;
  try {
    const { data: signed, error } = await ctx.supabase.storage.from(file.bucket).createSignedUrl(file.path, 300);
    if (error || !signed?.signedUrl) return null;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.RECEIPT_OCR_TOKEN ? { authorization: `Bearer ${process.env.RECEIPT_OCR_TOKEN}` } : {}),
      },
      body: JSON.stringify({ url: signed.signedUrl, mimeType: file.mime_type }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseOcr(await res.json());
  } catch (err) {
    logServerError("receipt.ocr", err);
    return null;
  }
}
