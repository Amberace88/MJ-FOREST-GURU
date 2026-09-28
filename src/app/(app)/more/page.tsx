import type { Metadata } from "next";
import { visibleNav } from "@/components/layout/nav-config";
import { PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { MoreList } from "./more-list";

export const metadata: Metadata = { title: "Vairāk" };

export default async function MorePage() {
  const ctx = await requireOrg();
  const groups = visibleNav(ctx.permissions, ctx.kind);
  // personal shortcuts first
  const personal = { key: "me", label: "nav.myWork" as const, items: [
    { key: "work", href: "/work", label: "nav.myWork" as const },
    { key: "notifications", href: "/notifications", label: "nav.notifications" as const },
  ] };
  return (
    <>
      <PageHeader title={ctx.t("nav.mobile.more")} subtitle={`${ctx.employee?.full_name ?? ctx.profile?.full_name ?? ""} · ${ctx.org.name}`} />
      <MoreList groups={[personal, ...groups]} />
    </>
  );
}
