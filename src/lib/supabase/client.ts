"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client (publishable key only). RLS applies to everything it does. */
export function getBrowserClient() {
  if (!client) client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey);
  return client;
}
