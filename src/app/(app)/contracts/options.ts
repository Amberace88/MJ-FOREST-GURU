import "server-only";
import type { OrgContext } from "@/lib/context";
import type { ContractOptions } from "./components";

/** Select options for the contract form: countries, own companies, contacts, projects. */
export async function loadContractOptions(ctx: OrgContext): Promise<ContractOptions> {
  const [contacts, projects] = await Promise.all([
    ctx.supabase.from("business_contacts").select("id, company_name").eq("organization_id", ctx.org.id).is("deleted_at", null).order("company_name").limit(1000),
    ctx.supabase.from("projects").select("id, code, name, status").eq("organization_id", ctx.org.id).is("deleted_at", null)
      .in("status", ["planned", "active", "paused"]).order("code").limit(1000),
  ]);
  return {
    countries: ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() })),
    companies: ctx.companies.map((c) => ({ value: c.id, label: c.name })),
    contacts: (contacts.data ?? []).map((c) => ({ value: c.id, label: c.company_name })),
    projects: (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
  };
}
