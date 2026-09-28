import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole } from "@/lib/env.server";
import { logServerError } from "@/lib/errors";
import { hashInviteToken } from "@/lib/invite";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * One-time invitation link: /invite/<token>
 * Valid token → the invited account is signed in on THIS device (server-side OTP
 * verification, no e-mail needed) → forced to set a password.
 * The link stops working once the password is set, revoked, or after 7 days.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(req.url).origin;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!rateLimit(`invite-open:${ip}`, 20, 15 * 60_000).ok) return fail("rate");
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token) || !hasServiceRole()) return fail("invite");

  const admin = createAdminClient();
  const { data: inv } = await admin.from("invitations").select("id, email, user_id, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token)).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at || !inv.user_id || new Date(inv.expires_at) < new Date()) return fail("invite");

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: inv.email });
  if (linkErr || !link.properties?.hashed_token) {
    logServerError("invite.generate_link", { message: linkErr?.message });
    return fail("invite");
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined); // never mix with another signed-in account
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error) {
    logServerError("invite.verify", { message: error.message });
    return fail("invite");
  }
  await admin.from("invitations").update({ opened_at: new Date().toISOString() }).eq("id", inv.id);
  return NextResponse.redirect(new URL("/reset-password?welcome=1", origin));
}
