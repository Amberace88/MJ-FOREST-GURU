import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole, serverEnv } from "@/lib/env.server";
import { syncTendersIfStale } from "@/lib/business/tender-sync";

/**
 * Daily refresh of the public tender cache (IUB Latvia + TED) and "new tender"
 * notifications. Optional: the business page also refreshes lazily.
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://mjforestguru.com/api/cron/tenders
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = serverEnv.cronSecret;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!serverEnv.cronSecret) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasServiceRole()) return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });
  const r = await syncTendersIfStale({ force: true });
  return NextResponse.json(r, { status: r.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
