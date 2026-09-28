import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { visibleNav } from "@/components/layout/nav-config";
import { getContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (!ctx.org) redirect("/no-access");

  // First-run wizard for owners until the company setup is completed
  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  if (ctx.roles.includes("owner") && !ctx.settings?.setup_completed_at && !ctx.org.is_demo && !path.startsWith("/setup")) {
    redirect("/setup");
  }

  const { count } = await ctx.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id)
    .is("read_at", null);

  const topRole = ctx.roles[0] ?? "employee";
  const needsPassword = !(await cookies()).get("mjfg_pw_set") && (await signedInViaEmailLink(ctx.supabase));
  const orgWide = ctx.can("view_all_projects") || ctx.can("view_all_employees");

  return (
    <AppShell
      locale={ctx.locale}
      userId={ctx.user.id}
      userName={ctx.employee?.full_name ?? ctx.profile?.full_name ?? ctx.user.email ?? ""}
      roleLabel={ctx.label("users.roleNames", topRole)}
      orgName={ctx.org.name}
      orgId={ctx.org.id}
      needsPassword={needsPassword}
      orgs={ctx.orgs.map((o) => ({ id: o.id, name: o.name, is_demo: o.is_demo }))}
      isDemo={ctx.org.is_demo}
      nav={visibleNav(ctx.permissions, ctx.kind)}
      perms={[...ctx.permissions]}
      countries={ctx.countries.map((c) => ({ id: c.id, code: c.code, name: c.name, flag: c.flag }))}
      countryId={ctx.countryId}
      showCountrySwitch={orgWide && ctx.countries.length > 1}
      unread={count ?? 0}
    >
      {children}
    </AppShell>
  );
}

/** True when the current session came from an invite / recovery / magic link (no password step). UI hint only. */
async function signedInViaEmailLink(sb: import("@/lib/context").OrgContext["supabase"]) {
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { amr?: { method: string }[] };
    const methods = (payload.amr ?? []).map((a) => a.method);
    return methods.length > 0 && !methods.includes("password");
  } catch {
    return false;
  }
}
