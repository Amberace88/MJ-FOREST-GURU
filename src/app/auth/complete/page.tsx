"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { lv } from "@/i18n/lv";
import { getBrowserClient } from "@/lib/supabase/client";

function safe(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/**
 * Finishes links from Supabase's default e-mail templates (used until custom SMTP +
 * the Latvian templates are configured): admin invites arrive with the session in the
 * URL fragment (#access_token=…), which a server route cannot read.
 */
export default function AuthComplete() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const type = hash.get("type") ?? url.searchParams.get("type");
      const fallback = type === "invite" ? "/reset-password?welcome=1" : type === "recovery" ? "/reset-password" : "/dashboard";
      const next = safe(url.searchParams.get("next"), fallback);
      const access = hash.get("access_token");
      const refresh = hash.get("refresh_token");
      if (hash.get("error") || !access || !refresh) { setFailed(true); return; }
      const sb = getBrowserClient();
      const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
      if (error) { setFailed(true); return; }
      // strip tokens from history, then continue on the server-rendered page
      window.history.replaceState(null, "", url.pathname);
      window.location.replace(type === "invite" && next === "/reset-password" ? "/reset-password?welcome=1" : next);
    })();
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-ink">
      {failed ? (
        <div>
          <p className="text-sm text-crit">{lv.auth.linkInvalid}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-muted hover:text-ink">{lv.auth.backToLogin}</a>
        </div>
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-moss" aria-label={lv.common.loading} />
      )}
    </main>
  );
}
