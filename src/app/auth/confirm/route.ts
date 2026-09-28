import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";

/**
 * Token-hash verification used by the Latvian email templates
 * (supabase/templates/*.html): invites, password recovery, email change.
 * Works across devices (no PKCE verifier needed).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const allowed: EmailOtpType[] = ["invite", "recovery", "email", "email_change", "signup", "magiclink"];
  const fallback = type === "invite" ? "/reset-password?welcome=1" : type === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeNext(url.searchParams.get("next"), fallback);
  if (tokenHash && type && allowed.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // No token in the query: the session may be in the URL fragment (Supabase default
  // templates / implicit flow). Browsers keep the fragment across this redirect.
  if (!url.searchParams.get("error") && !url.searchParams.get("token_hash") && !url.searchParams.get("code")) {
    const target = new URL("/auth/complete", url.origin);
    target.searchParams.set("next", url.searchParams.get("next") ?? "");
    const t = url.searchParams.get("type");
    if (t) target.searchParams.set("type", t);
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
