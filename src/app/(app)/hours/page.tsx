import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, Clock, Coffee, Sun, TrendingUp } from "lucide-react";
import Link from "next/link";
import { WorkLogTable, netHours, type WorkLogRow } from "@/components/shared/lists";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi";
import { Avatar, PageHeader, Pagination } from "@/components/ui/misc";
import { DataTable } from "@/components/ui/table";
import { requireOrg } from "@/lib/context";
import { addDays, fmtDate, fmtHours, fmtShortDate, fmtWeekday, hoursBetween, todayIn, utcToLocalInput, zonedMidnightUtc } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { searchParamsToString, sp as one } from "@/lib/utils";
import { ApproveButton, CloseShiftDialog, CorrectDialog, ManualLogDialog } from "./components";

export const metadata: Metadata = { title: "Darba stundas" };
const PAGE = 100;

type Row = WorkLogRow & {
  project_id: string | null; machine_id: string | null; notes: string | null;
  employee: { id: string; full_name: string; country_id: string | null } | null;
  project: { id: string; code: string; country_id: string } | null;
};

function localDate(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(date, -wd);
}

export default async function HoursPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const tz = ctx.timezone;
  const today = todayIn(tz);
  const seeOthers = ctx.canAny("view_employee_hours", "edit_employee_hours", "approve_hours");
  const from = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.from) ?? "") ? one(sp.from)! : mondayOf(today);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.to) ?? "") && one(sp.to)! >= from ? one(sp.to)! : today;
  const employeeId = seeOthers ? one(sp.employee) : ctx.employee?.id;
  const projectId = one(sp.project);
  const status = one(sp.status);
  const page = Math.max(1, Number(one(sp.page) ?? 1));
  const fromUtc = zonedMidnightUtc(from, tz).toISOString();
  const toUtc = zonedMidnightUtc(addDays(to, 1), tz).toISOString();
  const overtimeAfter = Number(ctx.settings?.overtime_after_hours ?? 8);
  const maxShift = Number(ctx.settings?.max_shift_hours ?? 12);

  let q = ctx.supabase.from("work_logs")
    .select("id, started_at, ended_at, status, work_type, source, notes, project_id, machine_id, employee:employees(id, full_name, country_id), project:projects(id, code, country_id), machine:machines(id, name), breaks:work_breaks(started_at, ended_at)")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).lt("started_at", toUtc).or(`ended_at.is.null,ended_at.gt.${fromUtc}`)
    .order("started_at", { ascending: false }).limit(3000);
  if (employeeId) q = q.eq("employee_id", employeeId);
  else if (!seeOthers) q = q.eq("employee_id", "00000000-0000-0000-0000-000000000000");
  if (projectId) q = q.eq("project_id", projectId);
  if (status) q = q.eq("status", status);
  const [{ data }, opts] = await Promise.all([q, getOptions(ctx)]);

  let rows = (data ?? []) as unknown as Row[];
  if (ctx.countryId) rows = rows.filter((r) => (r.project?.country_id ?? r.employee?.country_id) === ctx.countryId);

  // per employee/day aggregation (org timezone)
  const perEmp = new Map<string, { id: string; name: string; days: Map<string, number>; breaks: number; active: boolean; open: number }>();
  for (const r of rows) {
    const e = r.employee;
    if (!e) continue;
    const agg = perEmp.get(e.id) ?? { id: e.id, name: e.full_name, days: new Map(), breaks: 0, active: false, open: 0 };
    const day = localDate(r.started_at, tz);
    agg.days.set(day, (agg.days.get(day) ?? 0) + netHours(r));
    agg.breaks += (r.breaks ?? []).reduce((a, b) => a + hoursBetween(b.started_at, b.ended_at), 0);
    if (!r.ended_at) { agg.active = true; agg.open++; }
    perEmp.set(e.id, agg);
  }
  const summary = [...perEmp.values()].map((a) => {
    const net = [...a.days.values()].reduce((x, y) => x + y, 0);
    const overtime = [...a.days.values()].reduce((x, y) => x + Math.max(0, y - overtimeAfter), 0);
    return { ...a, net, overtime, regular: net - overtime, daysWorked: a.days.size };
  }).sort((a, b) => b.net - a.net);
  const totals = summary.reduce((t, s) => ({ net: t.net + s.net, overtime: t.overtime + s.overtime, breaks: t.breaks + s.breaks, days: t.days + s.daysWorked }), { net: 0, overtime: 0, breaks: 0, days: 0 });
  const projectsCount = new Set(rows.map((r) => r.project?.id).filter(Boolean)).size;

  const canApprove = ctx.can("approve_hours");
  const canCorrect = ctx.canAny("edit_employee_hours", "approve_hours");
  const approvable = rows.filter((r) => r.ended_at && (r.status === "completed" || r.status === "corrected")).map((r) => r.id);
  const longOpen = rows.filter((r) => !r.ended_at && hoursBetween(r.started_at, null) > maxShift);
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const dialogOpts = { employees: opts.employeeOptions, projects: opts.allProjectOptions, machines: opts.machineOptions, workTypes: opts.workTypes };

  const singleEmployee = employeeId ?? (summary.length === 1 ? summary[0].id : null);
  const nDays = Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000) + 1;

  return (
    <>
      <PageHeader title={ctx.t("hours.title")} subtitle={`${ctx.t("hours.subtitle")} · ${fmtDate(from)} – ${fmtDate(to)}`}
        actions={<>
          {canApprove && <ApproveButton ids={approvable} all />}
          {ctx.can("edit_employee_hours") && <ManualLogDialog opts={dialogOpts} defaultEmployee={employeeId ?? undefined} />}
        </>} />
      <FilterBar filters={[
        { type: "date", name: "from", label: ctx.t("common.from") },
        { type: "date", name: "to", label: ctx.t("common.to") },
        ...(seeOthers ? [{ type: "select" as const, name: "employee", label: ctx.t("common.employee"), options: opts.employeeOptions }] : []),
        { type: "select", name: "project", label: ctx.t("common.project"), options: opts.allProjectOptions },
        { type: "select", name: "status", label: ctx.t("common.status"), options: ["active", "completed", "corrected", "approved"].map((s) => ({ value: s, label: ctx.label("hours.status", s) })) },
      ]} />

      {longOpen.length > 0 && canCorrect && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{ctx.t("hours.longOpen", { n: longOpen.length, h: maxShift })}: {longOpen.map((r) => r.employee?.full_name).join(", ")}</div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label={ctx.t("hours.total")} value={totals.net} decimals={1} suffix=" h" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label={ctx.t("hours.regular")} value={totals.net - totals.overtime} decimals={1} suffix=" h" delay={60} icon={<Sun className="h-4 w-4" />} />
        <KpiCard label={ctx.t("hours.overtime")} value={totals.overtime} decimals={1} suffix=" h" tone="amber" delay={120} icon={<TrendingUp className="h-4 w-4" />} sub={ctx.t("hours.overtimeRule", { h: overtimeAfter })} />
        <KpiCard label={ctx.t("hours.breaks")} value={totals.breaks} decimals={1} suffix=" h" delay={180} tone="wood" icon={<Coffee className="h-4 w-4" />} />
        <KpiCard label={ctx.t("hours.daysWorked")} value={totals.days} delay={240} tone="info" icon={<CalendarDays className="h-4 w-4" />} sub={`${projectsCount} ${ctx.t("hours.projects").toLowerCase()}`} />
      </div>

      {singleEmployee && nDays <= 14 && rows.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={ctx.t("hours.timeline")} subtitle={summary.find((s) => s.id === singleEmployee)?.name} />
          <CardBody>
            <Timeline rows={rows.filter((r) => r.employee?.id === singleEmployee)} from={from} days={nDays} tz={tz} />
          </CardBody>
        </Card>
      )}

      {seeOthers && !employeeId && summary.length > 1 && (
        <Card className="mb-6">
          <CardHeader title={ctx.t("hours.perEmployee")} />
          <CardBody>
            <DataTable rows={summary} rowKey={(r) => r.id} href={(r) => `/hours${searchParamsToString(sp, { employee: r.id, page: null })}`}
              columns={[
                { key: "n", header: ctx.t("common.employee"), cell: (r) => <span className="flex items-center gap-2.5"><Avatar name={r.name} size={28} />{r.name}{r.active && <Badge tone="ok" dot pulse>{ctx.t("hours.active")}</Badge>}</span> },
                { key: "d", header: ctx.t("hours.daysWorked"), cell: (r) => r.daysWorked, align: "right", hideOnMobile: true },
                { key: "r", header: ctx.t("hours.regular"), cell: (r) => <span className="tabular">{fmtHours(r.regular)}</span>, align: "right", hideOnMobile: true },
                { key: "o", header: ctx.t("hours.overtime"), cell: (r) => <span className={r.overtime > 0 ? "tabular text-amber" : "tabular text-muted"}>{fmtHours(r.overtime)}</span>, align: "right" },
                { key: "t", header: ctx.t("hours.net"), cell: (r) => <span className="font-semibold tabular">{fmtHours(r.net)}</span>, align: "right" },
              ]} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={ctx.t("hours.entries")} subtitle={`${rows.length}`} />
        <CardBody>
          <WorkLogTable rows={pageRows} tr={ctx} tz={tz} showEmployee={seeOthers}
            actions={canCorrect ? (r) => {
              const row = r as Row;
              return (
                <span className="flex items-center justify-end gap-1">
                  {!row.ended_at
                    ? <CloseShiftDialog id={row.id} suggested={utcToLocalInput(new Date(Math.min(Date.now(), new Date(row.started_at).getTime() + overtimeAfter * 3600_000)).toISOString(), tz)} />
                    : <CorrectDialog opts={dialogOpts} v={{ id: row.id, started: utcToLocalInput(row.started_at, tz), ended: utcToLocalInput(row.ended_at, tz), project_id: row.project_id, machine_id: row.machine_id, work_type: row.work_type, notes: row.notes }} />}
                  {canApprove && row.ended_at && (row.status === "completed" || row.status === "corrected") && <ApproveButton ids={[row.id]} />}
                </span>
              );
            } : undefined} />
          <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(p) => `/hours${searchParamsToString(sp, { page: String(p) })}`} />
          {!seeOthers && <p className="mt-4 text-xs text-muted">{ctx.t("hours.ownOnly")} <Link href="/work" className="text-amber hover:underline">{ctx.t("nav.myWork")}</Link></p>}
        </CardBody>
      </Card>
    </>
  );
}

/** Day-by-day 24h bars: work segments (green), breaks (amber), active now (pulsing). */
function Timeline({ rows, from, days, tz }: { rows: Row[]; from: string; days: number; tz: string }) {
  const list = Array.from({ length: days }, (_, i) => addDays(from, i));
  return (
    <div className="space-y-2">
      <div className="ml-24 flex justify-between text-[10px] text-faint tabular"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      {list.map((day) => {
        const start = zonedMidnightUtc(day, tz).getTime();
        const end = zonedMidnightUtc(addDays(day, 1), tz).getTime();
        const span = end - start;
        const seg = (a: string, b: string | null) => {
          const s = Math.max(start, new Date(a).getTime());
          const e = Math.min(end, b ? new Date(b).getTime() : Date.now());
          return e > s ? { left: ((s - start) / span) * 100, width: ((e - s) / span) * 100 } : null;
        };
        const dayRows = rows.filter((r) => seg(r.started_at, r.ended_at));
        const total = dayRows.reduce((a, r) => a + netHours(r), 0);
        return (
          <div key={day} className="flex items-center gap-3">
            <div className="w-21 shrink-0 text-xs text-muted"><span className="capitalize">{fmtWeekday(day)}</span> {fmtShortDate(`${day}T12:00:00Z`)}</div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-3/60">
              {[25, 50, 75].map((p) => <span key={p} className="absolute inset-y-0 w-px bg-line" style={{ left: `${p}%` }} />)}
              {dayRows.map((r) => {
                const s = seg(r.started_at, r.ended_at)!;
                return (
                  <span key={r.id} title={`${r.project?.code ?? ""} ${r.work_type ?? ""}`}
                    className={`absolute inset-y-1 rounded ${r.ended_at ? "bg-forest-500/80" : "animate-pulse bg-forest-400"}`} style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.4)}%` }} />
                );
              })}
              {dayRows.flatMap((r) => (r.breaks ?? []).map((b, i) => {
                const s = seg(b.started_at, b.ended_at);
                return s ? <span key={`${r.id}-${i}`} className="absolute inset-y-2 rounded bg-amber/90" style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.3)}%` }} /> : null;
              }))}
            </div>
            <div className="w-14 shrink-0 text-right text-xs tabular text-ink-2">{total > 0 ? fmtHours(total) : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}
