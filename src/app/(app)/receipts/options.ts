import "server-only";
import type { OrgContext } from "@/lib/context";
import { getOptions } from "@/lib/queries";
import type { ReceiptFormOptions } from "./types";

/** Select options for receipt / expense forms (RLS-scoped; only active projects). */
export async function receiptFormOptions(ctx: OrgContext): Promise<ReceiptFormOptions> {
  const opts = await getOptions(ctx);
  const countryCurrency = new Map(ctx.countries.map((c) => [c.id, c.currency]));
  const projectCurrency: Record<string, string> = {};
  for (const p of opts.projects) {
    const c = p.country_id ? countryCurrency.get(p.country_id) : undefined;
    if (c) projectCurrency[p.id] = c;
  }
  return {
    projects: opts.projectOptions,
    machines: opts.machineOptions,
    fuelTypes: opts.fuelTypes.length ? opts.fuelTypes : [{ value: "diesel", label: "Diesel" }],
    projectCurrency,
  };
}

/** Default currency: selected country → organization default → EUR. */
export function defaultCurrency(ctx: OrgContext) {
  return ctx.country?.currency ?? ctx.settings?.default_currency ?? "EUR";
}
