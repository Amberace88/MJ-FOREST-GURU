import type { Metadata } from "next";
import { Lock, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { logout } from "@/app/(app)/shell-actions";
import { lv } from "@/i18n/lv";
import { getContext } from "@/lib/context";

export const metadata: Metadata = { title: "Nav piekļuves" };
export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const ctx = await getContext();
  if (ctx.org) redirect("/dashboard");
  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-3 text-amber"><Lock className="h-7 w-7" /></div>
      <h1 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide">{lv.auth.noAccess}</h1>
      <p className="mt-2 text-sm text-muted">{lv.auth.noAccessHint}</p>
      <p className="mt-4 text-xs text-faint">{ctx.user.email}</p>
      <form action={logout} className="mt-6">
        <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-5 text-sm hover:bg-surface-2">
          <LogOut className="h-4 w-4" /> {lv.auth.logout}
        </button>
      </form>
    </div>
  );
}
