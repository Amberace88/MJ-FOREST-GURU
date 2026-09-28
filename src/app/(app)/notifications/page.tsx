import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { cn, searchParamsToString, sp as one } from "@/lib/utils";

export const metadata: Metadata = { title: "Paziņojumi" };
const PAGE = 40;

async function markAll() {
  "use server";
  const ctx = await requireOrg();
  await ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.user.id).is("read_at", null);
  revalidatePath("/notifications");
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1));
  const { data, count } = await ctx.supabase.from("notifications").select("id, type, title, body, link, read_at, created_at", { count: "exact" })
    .eq("user_id", ctx.user.id).eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const rows = data ?? [];
  const unread = rows.some((r) => !r.read_at);
  return (
    <>
      <PageHeader title={ctx.t("notifications.title")}
        actions={unread && <form action={markAll}><Button type="submit" variant="secondary"><CheckCheck className="h-4 w-4" /> {ctx.t("notifications.markAllRead")}</Button></form>} />
      {rows.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title={ctx.t("notifications.empty")} /> : (
        <Card>
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {rows.map((n) => {
                const inner = (
                  <div className="flex gap-3 py-3.5">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-amber")} />
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm", !n.read_at && "font-semibold text-ink")}>{n.title}</div>
                      {n.body && <div className="mt-0.5 text-sm text-muted">{n.body}</div>}
                    </div>
                    <time className="shrink-0 text-xs text-faint" dateTime={n.created_at} title={fmtDateTime(n.created_at, ctx.timezone)}>{fmtRelative(n.created_at)}</time>
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-surface-2/40">{inner}</Link> : inner}</li>;
              })}
            </ul>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/notifications${searchParamsToString(sp, { page: String(p) })}`} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
