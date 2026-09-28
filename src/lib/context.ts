import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getT } from "@/i18n/server";
import type { CompanyLite } from "@/lib/companies";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardKind, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const ORG_COOKIE = "mjfg_org";
export const COUNTRY_COOKIE = "mjfg_country";
export const COMPANY_COOKIE = "mjfg_company";

export type Country = {
  id: string;
  code: string;
  name: string;
  flag: string | null;
  timezone: string;
  currency: string;
  site_identifier_fields: string[];
};

export type AppContext = Awaited<ReturnType<typeof loadContext>>;

async function loadContext() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, status, organizations(id, name, slug, is_demo)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const cookieStore = await cookies();
  const preferredOrg = cookieStore.get(ORG_COOKIE)?.value;
  const orgs = (memberships ?? [])
    .map((m) => m.organizations)
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    // real company first; demo organizations only when explicitly selected
    .sort((a, b) => Number(a.is_demo) - Number(b.is_demo) || a.name.localeCompare(b.name));
  const org = orgs.find((o) => o.id === preferredOrg) ?? orgs[0] ?? null;

  if (!org) {
    return { user, org: null } as const;
  }

  const [permsRes, rolesRes, employeeRes, profileRes, settingsRes, countriesRes, companiesRes] = await Promise.all([
    supabase.rpc("my_permissions", { p_org: org.id }),
    supabase.rpc("my_roles", { p_org: org.id }),
    supabase
      .from("employees")
      .select("id, first_name, last_name, full_name, country_id, team_id, photo_path, job_title, status")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, email, locale, timezone, avatar_path").eq("id", user.id).maybeSingle(),
    supabase.from("organization_settings").select("*").eq("organization_id", org.id).maybeSingle(),
    supabase
      .from("countries")
      .select("id, code, name, flag, timezone, currency, site_identifier_fields")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("companies")
      .select("id, name, color, country_id, is_active")
      .eq("organization_id", org.id)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name"),
  ]);

  const permissions = new Set<string>(permsRes.data ?? []);
  const roles = (rolesRes.data ?? []) as string[];
  const countries = (countriesRes.data ?? []).map((c) => ({
    ...c,
    site_identifier_fields: Array.isArray(c.site_identifier_fields) ? (c.site_identifier_fields as string[]) : [],
  })) as Country[];

  const countryCookie = cookieStore.get(COUNTRY_COOKIE)?.value;
  const countryId = countries.some((c) => c.id === countryCookie) ? countryCookie! : null;
  // Legal companies of the organization. `companiesAll` keeps inactive ones (badges, edit forms);
  // `companies` (active) drives the filter and new-record defaults.
  const companiesAll: CompanyLite[] = companiesRes.data ?? [];
  const companies = companiesAll.filter((c) => c.is_active);
  const companyCookie = cookieStore.get(COMPANY_COOKIE)?.value;
  const companyId = companies.some((c) => c.id === companyCookie) ? companyCookie! : null;
  const settings = settingsRes.data;
  const profile = profileRes.data;
  const locale = profile?.locale ?? settings?.default_language ?? "lv";
  const timezone = profile?.timezone ?? settings?.default_timezone ?? "Europe/Riga";

  return {
    user,
    org,
    orgs,
    permissions,
    roles,
    kind: dashboardKind(roles),
    employee: employeeRes.data,
    profile,
    settings,
    countries,
    countryId,
    country: countries.find((c) => c.id === countryId) ?? null,
    companies,
    companiesAll,
    companyId,
    company: companies.find((c) => c.id === companyId) ?? null,
    locale,
    timezone,
    can: (...p: Permission[]) => p.every((x) => permissions.has(x)),
    canAny: (...p: Permission[]) => p.some((x) => permissions.has(x)),
    supabase,
    ...getT(locale),
  } as const;
}

/** Request-scoped app context (user, organization, permissions, filters, translator). */
export const getContext = cache(loadContext);

/** Same as getContext but guarantees an organization (redirects to /no-access otherwise). */
export async function requireOrg() {
  const ctx = await getContext();
  if (!ctx.org) redirect("/no-access");
  return ctx as Extract<AppContext, { org: { id: string } }>;
}

export type OrgContext = Awaited<ReturnType<typeof requireOrg>>;

/** Page-level permission gate: renders "no permission" state via redirect. */
export async function requirePermission(...perms: Permission[]) {
  const ctx = await requireOrg();
  if (!perms.some((p) => ctx.permissions.has(p))) redirect("/dashboard?denied=1");
  return ctx;
}
