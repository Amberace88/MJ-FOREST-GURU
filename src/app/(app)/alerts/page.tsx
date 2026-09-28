import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { AlertList, type AlertRow } from "@/components/dashboard/alert-list";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader, TabNav } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";

export const metadata: Metadata = { title: "Brīdinājumi" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const { data } = await ctx.supabase.rpc("get_alerts", { p_org: ctx.org.id, p_country: ctx.countryId ?? undefined });
  const all = (data ?? []) as AlertRow[];
  const sev = ["critical", "warning", "info"].includes(sp.severity ?? "") ? sp.severity! : "all";
  const list = sev === "all" ? all : all.filter((a) => a.severity === sev);
  const count = (s: string) => all.filter((a) => a.severity === s).length;
  return (
    <>
      <PageHeader title={ctx.t("alerts.title")} subtitle={ctx.t("alerts.subtitle")}
        actions={<>
          <Badge tone="crit" dot pulse={count("critical") > 0}>{ctx.label("alerts.severity", "critical")} · {count("critical")}</Badge>
          <Badge tone="warn" dot>{ctx.label("alerts.severity", "warning")} · {count("warning")}</Badge>
          {ctx.can("manage_settings") && <ButtonLink href="/settings?tab=alerts" variant="ghost" size="sm"><Settings2 className="h-4 w-4" /> {ctx.t("alerts.configure")}</ButtonLink>}
        </>} />
      <TabNav active={sev} items={[
        { key: "all", label: ctx.t("common.all"), href: "/alerts", count: all.length },
        { key: "critical", label: ctx.label("alerts.severity", "critical"), href: "/alerts?severity=critical", count: count("critical") },
        { key: "warning", label: ctx.label("alerts.severity", "warning"), href: "/alerts?severity=warning", count: count("warning") },
        { key: "info", label: ctx.label("alerts.severity", "info"), href: "/alerts?severity=info", count: count("info") },
      ]} />
      <Card><CardBody className="pt-5"><AlertList alerts={list} tr={ctx} /></CardBody></Card>
    </>
  );
}
