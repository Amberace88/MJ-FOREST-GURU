import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";

/** PKCE code exchange (password recovery started in this browser). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/dashboard");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
