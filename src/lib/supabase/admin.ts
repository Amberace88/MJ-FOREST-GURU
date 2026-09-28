import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * SERVICE ROLE client — bypasses RLS. Server-only, never exposed to the browser.
 * Use ONLY for: sending invitations (auth admin API), reading integration
 * secrets, Mapon sync jobs and audit of failed logins. Always perform an explicit
 * permission check with the user's own client before calling it.
 */
export function createAdminClient() {
  if (!serverEnv.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
