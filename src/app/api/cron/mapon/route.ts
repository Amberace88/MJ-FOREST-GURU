import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole, serverEnv } from "@/lib/env.server";
import { maponEnabledOrgs, syncUnits } from "@/lib/integrations/mapon";

/**
 * Scheduled Mapon synchronisation for every organization with the Mapon
 * integration enabled. Call every 5–15 minutes from an external scheduler
 * (cron-job.org, GitHub Actions, Netlify scheduled function…):
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.mjforestguru.com/api/cron/mapon
 *
 * Protected by CRON_SECRET (constant-time comparison). Uses the service role
 * server-side only; responses contain counts, never data or secrets.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = serverEnv.cronSecret;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!serverEnv.cronSecret) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasServiceRole()) return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 503 });

  const started = Date.now();
  const orgs = await maponEnabledOrgs();
  const results: { ok: boolean; units?: number; positions?: number; error?: string }[] = [];
  for (const orgId of orgs) {
    if (Date.now() - started > 50_000) {
      results.push({ ok: false, error: "time_budget_exceeded" });
      break;
    }
    const r = await syncUnits(orgId);
    results.push(r.ok ? { ok: true, units: r.data.units, positions: r.data.positions } : { ok: false, error: r.code });
  }
  return NextResponse.json(
    { ok: results.every((r) => r.ok), organizations: orgs.length, results, durationMs: Date.now() - started },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
