import type { Metadata } from "next";
import Link from "next/link";
import { lv } from "@/i18n/lv";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Jauna parole" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-crit">{lv.auth.linkInvalid}</p>
        <Link href="/forgot-password" className="text-sm text-muted hover:text-ink">{lv.auth.forgotTitle}</Link>
      </div>
    );
  }
  return <SetPasswordForm welcome={sp.welcome === "1"} required={sp.required === "1" || user.app_metadata?.must_change_password === true} email={user.email ?? null} />;
}
