import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { sp as one } from "@/lib/utils";
import { Calculators } from "./calculators";
import { loadCalcPrefill } from "./prefill";
import { isTab } from "./state";

export const metadata: Metadata = { title: "Kalkulatori" };

export default async function CalculatorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const prefill = await loadCalcPrefill(ctx);

  return (
    <>
      <PageHeader
        eyebrow={<><Calculator className="h-3.5 w-3.5 text-amber" aria-hidden /><span>{ctx.t("calculators.eyebrow")}</span></>}
        title={ctx.t("calculators.title")}
        subtitle={ctx.t("calculators.subtitle")}
      />
      <Calculators prefill={prefill} initialTab={isTab(tabParam) ? tabParam : "volume"} />
    </>
  );
}
