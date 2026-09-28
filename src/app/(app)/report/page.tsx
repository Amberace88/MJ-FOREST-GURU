import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { getOptions } from "@/lib/queries";
import { ReportHub, type ReportKind } from "./report-hub";

export const metadata: Metadata = { title: "Ziņot" };

const KINDS: ReportKind[] = ["fuel", "expense", "repair", "photo", "incident", "production"];
const EXPENSE_CATEGORIES = ["fuel", "repair", "parts", "accommodation", "food", "transport", "tools", "materials", "other"];

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const opts = await getOptions(ctx);
  const type = KINDS.includes(sp.type as ReportKind) ? (sp.type as ReportKind) : null;

  const employeeCountry = ctx.countries.find((c) => c.id === ctx.employee?.country_id);
  const currency = (ctx.country?.currency ?? employeeCountry?.currency ?? ctx.settings?.default_currency ?? "EUR") as "EUR" | "SEK" | "ISK";

  // active shift → sensible defaults (the worker is probably reporting about it)
  const { data: shift } = ctx.employee
    ? await ctx.supabase.from("work_logs").select("project_id, machine_id").eq("employee_id", ctx.employee.id).is("ended_at", null).is("deleted_at", null).maybeSingle()
    : { data: null };

  const allowed: ReportKind[] = KINDS.filter((k) => {
    if (k === "expense") return ctx.can("create_expense");
    if (k === "production") return Boolean(ctx.employee);
    return true;
  });

  return (
    <>
      <PageHeader title={ctx.t("report.title")} subtitle={ctx.t("report.subtitle")} />
      <ReportHub
        orgId={ctx.org.id}
        userId={ctx.user.id}
        initial={type && allowed.includes(type) ? type : null}
        allowed={allowed}
        currency={currency}
        defaults={{ projectId: shift?.project_id ?? null, machineId: shift?.machine_id ?? null }}
        projects={opts.projectOptions}
        machines={opts.machineOptions}
        fuelTypes={opts.fuelTypes.length ? opts.fuelTypes : [{ value: "diesel", label: "Dīzelis" }]}
        problemCategories={opts.problemCategories.length ? opts.problemCategories : [{ value: "other", label: ctx.t("machines.categories.other") }]}
        expenseCategories={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: ctx.label("expenses.categories", c) }))}
      />
    </>
  );
}
