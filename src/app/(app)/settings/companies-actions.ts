"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, parseForm, zf, type ActionResult } from "@/lib/actions";
import { DEFAULT_COMPANY_COLOR, HEX_COLOR_RE } from "@/lib/companies";
import { requireOrg, type OrgContext } from "@/lib/context";

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;

function companySchema(ctx: OrgContext) {
  return z.object({
    name: zf.reqText(200),
    legal_name: zf.text(200).optional(),
    registration_number: zf.text(60).optional(),
    vat_number: zf.text(60).optional(),
    country_id: zf.optUuid(),
    address: zf.text(300).optional(),
    email: zf.email().optional(),
    phone: zf.text(40).optional(),
    color: z.string().regex(HEX_COLOR_RE, ctx.t("companies.invalidColor")).default(DEFAULT_COMPANY_COLOR),
    is_active: zf.bool(),
    sort_order: z.coerce.number({ error: "Jābūt skaitlim" }).int("Jābūt veselam skaitlim").min(0, "Minimums 0").max(9999, "Maksimums 9999").default(0),
  });
}

/** Everything that shows companies (topbar filter, forms, lists, dashboard) lives under the app layout. */
function revalidateCompanies() {
  revalidatePath("/", "layout");
}

function companyDbFail(ctx: OrgContext, scope: string, error: { code?: string; message?: string; details?: string | null }) {
  if (error.code === "23505" || /uq_companies_org_name/.test(`${error.message ?? ""} ${error.details ?? ""}`)) {
    return fail(ctx.t("companies.nameTaken"), { name: ctx.t("companies.nameTaken") });
  }
  return dbFail(scope, error);
}

/** Create (id = "") or update a company. manage_settings only (also enforced by RLS). */
export async function saveCompany(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  if (id && !isUuid(id)) return fail(ctx.t("errors.validation"));
  const parsed = parseForm(companySchema(ctx), fd);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  if (d.country_id && !ctx.countries.some((c) => c.id === d.country_id)) {
    // inactive country: still valid in the organization — the DB guard checks the organization
    const { data: country } = await ctx.supabase.from("countries").select("id").eq("id", d.country_id).eq("organization_id", ctx.org.id).maybeSingle();
    if (!country) return fail(ctx.t("errors.validation"), { country_id: ctx.t("errors.notFound") });
  }
  const row = {
    name: d.name.trim(),
    legal_name: d.legal_name ?? null,
    registration_number: d.registration_number ?? null,
    vat_number: d.vat_number ? d.vat_number.toUpperCase().replace(/\s+/g, "") : null,
    country_id: d.country_id ?? null,
    address: d.address ?? null,
    email: d.email?.toLowerCase() ?? null,
    phone: d.phone ?? null,
    color: d.color.toLowerCase(),
    is_active: d.is_active,
    sort_order: d.sort_order,
  };
  if (id) {
    const { error } = await ctx.supabase.from("companies").update(row)
      .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
    if (error) return companyDbFail(ctx, "company.update", error);
  } else {
    const { error } = await ctx.supabase.from("companies").insert({ ...row, organization_id: ctx.org.id });
    if (error) return companyDbFail(ctx, "company.create", error);
  }
  revalidateCompanies();
  return { ok: true, message: ctx.t("settings.saved") };
}

export async function setCompanyActive(id: string, active: boolean, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("companies").update({ is_active: active })
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
  if (error) return dbFail("company.toggle", error);
  revalidateCompanies();
  return { ok: true, message: ctx.t("settings.saved") };
}

/** Soft delete: linked records keep their company_id (history), the company disappears from filters and forms. */
export async function removeCompany(id: string, _prev: ActionResult, _fd: FormData): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx.can("manage_settings")) return fail(ctx.t("errors.permission"));
  if (!isUuid(id)) return fail(ctx.t("errors.validation"));
  const { error } = await ctx.supabase.from("companies").update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null);
  if (error) return dbFail("company.remove", error);
  revalidateCompanies();
  return { ok: true, message: ctx.t("companies.removed") };
}
