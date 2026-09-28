import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { WorkLogTable, netHours, type WorkLogRow } from "@/components/shared/lists";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { addDays, fmtHours, todayIn, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { WorkPanel } from "./work-panel";

export const metadata: Metadata = { title: "Mans darbs" };

export default async function WorkPage() {
  const ctx = await requireOrg();
  const tz = ctx.timezone;

  if (!ctx.employee) {
    return (
      <>
        <PageHeader title={ctx.t("work.title")} />
        <EmptyState icon={<Clock className="h-6 w-6" />} title={ctx.t("work.noEmployee")} />
      </>
    );
  }

  const today = todayIn(tz);
  const weekStart = zonedMidnightUtc(addDays(today, -6), tz).toISOString();
  const [activeRes, recentRes, assignedRes, opts] = await Promise.all([
    ctx.supabase.from("work_logs")
      .select("id, started_at, project_id, machine_id, work_type, breaks:work_breaks(id, started_at, ended_at)")
      .eq("employee_id", ctx.employee.id).is("ended_at", null).is("deleted_at", null).maybeSingle(),
    ctx.supabase.from("work_logs")
      .select("id, started_at, ended_at, status, work_type, source, project:projects(id, code), machine:machines(id, name), breaks:work_breaks(started_at, ended_at)")
      .eq("employee_id", ctx.employee.id).is("deleted_at", null).gte("started_at", weekStart).order("started_at", { ascending: false }).limit(40),
    ctx.supabase.from("project_workers").select("project_id").eq("employee_id", ctx.employee.id).is("unassigned_at", null),
    getOptions(ctx),
  ]);

  const recent = (recentRes.data ?? []) as unknown as WorkLogRow[];
  const todayStart = zonedMidnightUtc(today, tz).getTime();
  const doneToday = recent.filter((l) => l.ended_at && new Date(l.started_at).getTime() >= todayStart).reduce((a, l) => a + netHours(l), 0);
  const weekTotal = recent.filter((l) => l.ended_at).reduce((a, l) => a + netHours(l), 0);

  // assigned projects first, then everything else the user can see
  const assigned = new Set((assignedRes.data ?? []).map((r) => r.project_id));
  const openProjects = opts.projects.filter((p) => ["active", "planned", "paused"].includes(p.status));
  const projectOptions = [
    ...openProjects.filter((p) => assigned.has(p.id)).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, group: ctx.t("dashboard.myProject") })),
    ...openProjects.filter((p) => !assigned.has(p.id)).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, group: ctx.t("projects.title") })),
  ];
  const active = activeRes.data;
  type Brk = { id: string; started_at: string; ended_at: string | null };
  const breaks = (active?.breaks ?? []) as unknown as Brk[];
  const openBreak = breaks.find((b) => !b.ended_at);

  return (
    <>
      <PageHeader title={ctx.t("work.title")} subtitle={ctx.employee.full_name} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WorkPanel
          orgId={ctx.org.id}
          userId={ctx.user.id}
          tz={tz}
          doneTodayHours={doneToday}
          active={active ? {
            id: active.id, startedAt: active.started_at, projectId: active.project_id, machineId: active.machine_id, workType: active.work_type,
            openBreakId: openBreak?.id ?? null,
            breakStartedAt: openBreak?.started_at ?? null,
            closedBreakMs: breaks.filter((b) => b.ended_at).reduce((a, b) => a + (new Date(b.ended_at!).getTime() - new Date(b.started_at).getTime()), 0),
          } : null}
          projects={projectOptions}
          machines={opts.machines.filter((m) => m.status !== "broken").map((m) => ({ value: m.id, label: m.name + (m.internal_code ? ` (${m.internal_code})` : "") }))}
          workTypes={opts.workTypes}
          defaultProjectId={[...assigned][0] ?? null}
        />
        <Card>
          <CardHeader title={ctx.t("dashboard.myHours")} subtitle={ctx.t("common.thisWeek")} icon={<Clock className="h-4 w-4" />} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">{ctx.t("common.today")}</div>
                <div className="font-display text-3xl font-bold tabular">{fmtHours(doneToday)}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                <div className="text-xs uppercase tracking-wider text-muted">7 d.</div>
                <div className="font-display text-3xl font-bold tabular">{fmtHours(weekTotal)}</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader title={ctx.t("hours.title")} subtitle={ctx.t("work.last7")} />
          <CardBody><WorkLogTable rows={recent} tr={ctx} tz={tz} showEmployee={false} /></CardBody>
        </Card>
      </div>
    </>
  );
}
