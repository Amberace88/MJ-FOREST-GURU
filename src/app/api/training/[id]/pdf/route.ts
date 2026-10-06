import { NextResponse, type NextRequest } from "next/server";
import { requireOrg } from "@/lib/context";
import { logServerError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { pdfFileName } from "@/lib/training/categories";
import type { MaterialCategory } from "@/lib/training/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (body: string, status: number, extra?: Record<string, string>) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...extra } });

/**
 * GET /api/training/{id}/pdf — A4 PDF of a training material.
 * Runs with the USER-scoped Supabase client: RLS decides whether the material is readable
 * (published for members, drafts only with manage_safety).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return text("Not found", 404);

  // requireOrg() redirects to /login or /no-access when there is no session/membership.
  const ctx = await requireOrg();
  const limited = rateLimit(`training-pdf:${ctx.user.id}`, 30, 60_000);
  if (!limited.ok) return text(ctx.t("errors.rateLimited"), 429, { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) });

  const { data: m, error } = await ctx.supabase.from("training_materials")
    .select("title, subtitle, summary, category, version, status, published_at, updated_at, country_id, audience, reading_minutes, requires_acknowledgement, body")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (error) logServerError("materials.pdf_load", error);
  if (!m) return text(ctx.t("errors.notFound"), 404);

  try {
    const pdf = await (await import("@/lib/training/pdf/document")).renderMaterialPdf({
      title: m.title, subtitle: m.subtitle, summary: m.summary, category: m.category as MaterialCategory, version: m.version,
      date: m.published_at ?? m.updated_at, country: ctx.countries.find((c) => c.id === m.country_id)?.name ?? null,
      audience: m.audience, readingMinutes: m.reading_minutes, requiresAck: m.requires_acknowledgement, body: m.body,
    }, ctx.org.name, { assetOrigin: req.nextUrl.origin });
    const name = pdfFileName(m.title, m.version);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    logServerError("materials.pdf_render", e);
    return text(ctx.t("errors.generic"), 500);
  }
}
