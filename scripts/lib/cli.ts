/**
 * Shared helpers for the operator scripts (run with `npx tsx`, NOT part of the Next.js bundle).
 * Loads .env.local / .env without overriding variables already set in the shell,
 * parses --flags and creates a service-role Supabase client.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

export function loadEnvFiles(root = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(root, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      const [, key, rawValue] = m;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "");
      process.env[key] = value;
    }
  }
}

export type Flags = Record<string, string | true> & { _multi: Record<string, string[]> };

export function parseFlags(argv = process.argv.slice(2)): Flags {
  const flags = { _multi: {} } as Flags;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const body = a.slice(2);
    const eq = body.indexOf("=");
    const k = eq === -1 ? body : body.slice(0, eq);
    const inline = eq === -1 ? undefined : body.slice(eq + 1);
    const next = argv[i + 1];
    const value: string | true = inline !== undefined ? inline : next !== undefined && !next.startsWith("--") ? (i++, next) : true;
    flags[k] = value;
    if (typeof value === "string") (flags._multi[k] ??= []).push(value);
  }
  return flags;
}

export function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function die(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) die(`Missing environment variable ${name} (set it in .env.local or the shell).`);
  return v;
}

export function adminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type Admin = ReturnType<typeof adminClient>;

export function appUrl(): string {
  const url = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!url) die("Missing NEXT_PUBLIC_APP_URL (e.g. https://app.mjforestguru.com) — needed for auth links.");
  return url;
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/** Finds an auth user id by e-mail through public.profiles (mirrors auth.users.email). */
export async function findUserId(admin: Admin, email: string): Promise<string | null> {
  const { data, error } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (error) die(`Could not query profiles: ${error.message}`);
  return data?.id ?? null;
}

/**
 * Makes sure an auth user exists for `email`.
 *  - default: sends the Latvian invite e-mail (Supabase Auth SMTP must be configured)
 *  - printLink: creates the user without e-mail and prints a one-time set-password link
 */
export async function ensureUser(admin: Admin, email: string, fullName: string, opts: { printLink: boolean }): Promise<{ id: string; created: boolean }> {
  const existing = await findUserId(admin, email);
  if (existing) return { id: existing, created: false };
  const base = appUrl();

  if (!opts.printLink) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${base}/auth/confirm?next=/reset-password`,
      data: { full_name: fullName },
    });
    if (error || !data.user) die(`Invite e-mail failed for ${email}: ${error?.message ?? "unknown"}\n  Tip: configure custom SMTP in Supabase or re-run with --print-link.`);
    console.log(`  ✉  Invitation e-mail sent to ${email}`);
    return { id: data.user.id, created: true };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (createErr || !created.user) die(`Could not create user ${email}: ${createErr?.message ?? "unknown"}`);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (linkErr || !link.properties?.hashed_token) die(`Could not generate a set-password link: ${linkErr?.message ?? "unknown"}`);
  const url = `${base}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=${encodeURIComponent("/reset-password?welcome=1")}`;
  console.log(`  🔗 One-time set-password link for ${email} (share privately, expires per Supabase "Email OTP expiry"):\n     ${url}`);
  return { id: created.user.id, created: true };
}

export function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}
