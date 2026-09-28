import { NextResponse, type NextRequest } from "next/server";
import { isIsoDate, monthStart } from "@/app/(app)/analytics/period";
import { isReportType, PERIODLESS, REPORT_PERMS, type ExportFormat } from "@/app/(app)/reports/config";
import { requireOrg } from "@/lib/context";
import { dbErrorKey, logServerError } from "@/lib/errors";
import { addDays, todayIn, zonedMidnightUtc } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { buildReport, ExportError } from "./builders";
import { csvDialect, csvLine } from "./csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function daysInclusive(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/**
 * CSV export (GET /api/export/{type}?from&to&country&format=csv|excel).
 * Runs with the USER-scoped Supabase client — RLS decides which rows appear.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isReportType(type)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // requireOrg() redirects to /login or /no-access when there is no session/membership.
  const ctx = await requireOrg();
  if (!ctx.can("export_reports") || !ctx.canAny(...REPORT_PERMS[type])) {
    return new NextResponse(ctx.t("errors.permission"), { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const limited = rateLimit(`export:${ctx.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return new NextResponse(ctx.t("errors.rateLimited"), {
      status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) },
    });
  }

  const sp = req.nextUrl.searchParams;
  const tz = ctx.settings?.default_timezone ?? ctx.timezone;
  const today = todayIn(tz);
  let from = sp.get("from") ?? "";
  let to = sp.get("to") ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) { from = monthStart(today); to = today; }
  if (daysInclusive(from, to) > 366) from = addDays(to, -365);
  const countryParam = sp.get("country");
  const country = countryParam && ctx.countries.some((c) => c.id === countryParam) ? countryParam : null;
  const format: ExportFormat = sp.get("format") === "excel" ? "excel" : "csv";
  const dialect = csvDialect(format);

  let spec: Awaited<ReturnType<typeof buildReport>>;
  let first: IteratorResult<unknown[][]>;
  try {
    spec = await buildReport(type, ctx, {
      from, to, tz, country,
      fromUtc: zonedMidnightUtc(from, tz).toISOString(),
      toUtc: zonedMidnightUtc(addDays(to, 1), tz).toISOString(),
    });
    // Pull the first batch before responding so query/permission errors still produce a proper status code.
    first = await spec.batches.next();
  } catch (e) {
    const db = e instanceof ExportError ? e.db : null;
    logServerError(`export.${type}`, e);
    return new NextResponse(ctx.t(dbErrorKey(db)), { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const encoder = new TextEncoder();
  const batches = spec.batches;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(dialect.bom + csvLine(spec.headers, dialect)));
      if (!first.done) controller.enqueue(encoder.encode(first.value.map((r) => csvLine(r as Parameters<typeof csvLine>[0], dialect)).join("")));
      else controller.close();
    },
    async pull(controller) {
      if (first.done) return;
      try {
        const next = await batches.next();
        if (next.done) { controller.close(); return; }
        controller.enqueue(encoder.encode(next.value.map((r) => csvLine(r, dialect)).join("")));
      } catch (e) {
        logServerError(`export.${type}.stream`, e);
        controller.error(e);
      }
    },
    async cancel() {
      await batches.return(undefined);
    },
  });

  const suffix = PERIODLESS.includes(type) ? today : `${from}_${to}`;
  const countryCode = country ? `-${ctx.countries.find((c) => c.id === country)?.code ?? ""}`.toLowerCase() : "";
  const filename = `mjforestguru-${type}${countryCode}-${suffix}${format === "excel" ? "-excel" : ""}.csv`;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": `text/csv; charset=utf-8${format === "excel" ? "; header=present" : ""}`,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
