import type { Metadata } from "next";
import { AlarmClock, Banknote, CalendarRange, FileSignature, Search, Trees } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import {
  CONTRACT_GROUPS, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, contractValue, daysBetween, timeProgress, upcomingDates,
  WORK_TYPE_LABEL, type ContractStatus, type WorkType,
} from "@/lib/contracts";
import { fmtDate, fmtMoney, fmtNumber, todayIn } from "@/lib/format";
import { cn, sp as one } from "@/lib/utils";
import { NewContractDialog } from "./components";
import { loadContractOptions } from "./options";

export const metadata: Metadata = { title: "Līgumi" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const GROUPS = ["current", "pipeline", "closed", "all"] as const;
const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = { current: "Spēkā esošie", pipeline: "Sarunās", closed: "Noslēgtie", all: "Visi" };

export type ContractListRow = {
  id: string; title: string; number: string | null; client_name: string | null; status: ContractStatus; work_type: string; source: string;
  start_date: string | null; end_date: string | null; notice_date: string | null; signed_at: string | null; pricing_model: string;
  unit_price: number | null; total_value: number | null; currency: string; volume_m3: number | null; area_ha: number | null;
  project_id: string | null; contact: { company_name: string } | null; project: { id: string; code: string; name: string } | null;
};

export default async function ContractsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission("manage_projects", "view_finance");
  const sp = await searchParams;
  const group = GROUPS.find((g) => g === one(sp.g)) ?? "current";
  const q = (one(sp.q) ?? "").trim().toLowerCase().slice(0, 80);
  const today = todayIn(ctx.timezone);
  const canEdit = ctx.can("manage_projects");

  const [contractsRes, milestonesRes, options] = await Promise.all([
    ctx.supabase.from("contracts")
      .select("id, title, number, client_name, status, work_type, source, start_date, end_date, notice_date, signed_at, pricing_model, unit_price, total_value, currency, volume_m3, area_ha, project_id, contact:business_contacts(company_name), project:projects(id, code, name)")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("end_date", { ascending: true, nullsFirst: false }).limit(1000),
    ctx.supabase.from("contract_milestones").select("contract_id, title, kind, due_date, done_at, amount")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).is("done_at", null).limit(2000),
    canEdit ? loadContractOptions(ctx) : Promise.resolve(null),
  ]);
  const all = (contractsRes.data ?? []) as unknown as ContractListRow[];
  const projectIds = [...new Set(all.map((c) => c.project_id).filter((x): x is string => Boolean(x)))];
  const { data: prod } = projectIds.length
    ? await ctx.supabase.from("production_logs").select("project_id, quantity").in("project_id", projectIds).eq("unit", "m3").is("deleted_at", null).limit(20000)
    : { data: [] as { project_id: string; quantity: number }[] };
  const produced = new Map<string, number>();
  for (const p of prod ?? []) produced.set(p.project_id, (produced.get(p.project_id) ?? 0) + Number(p.quantity));

  const inGroup = (c: ContractListRow) => group === "all" || (CONTRACT_GROUPS[group] as readonly string[]).includes(c.status);
  const matches = (c: ContractListRow) => !q || [c.title, c.number, c.client_name, c.contact?.company_name, c.project?.code].some((x) => x?.toLowerCase().includes(q));
  const rows = all.filter((c) => inGroup(c) && matches(c));

  const current = all.filter((c) => (CONTRACT_GROUPS.current as readonly string[]).includes(c.status));
  const pipeline = all.filter((c) => (CONTRACT_GROUPS.pipeline as readonly string[]).includes(c.status));
  const sumByCur = (list: ContractListRow[]) => {
    const m = new Map<string, number>();
    for (const c of list) { const v = contractValue(c).value; if (v) m.set(c.currency, (m.get(c.currency) ?? 0) + v); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const currentValue = sumByCur(current);
  const pipelineValue = sumByCur(pipeline);
  const due = upcomingDates(all, (milestonesRes.data ?? []) as never, today, 60);
  const dueSoon = due.filter((d) => daysBetween(today, d.date) <= 14);
  const endingSoon = current.filter((c) => c.end_date && daysBetween(today, c.end_date) >= 0 && daysBetween(today, c.end_date) <= 60).length;
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (group !== "current") p.set("g", group);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) if (v == null) p.delete(k); else p.set(k, v);
    const s = p.toString();
    return s ? `/contracts?${s}` : "/contracts";
  };

  return (
    <>
      <PageHeader title="Līgumi" subtitle="Visi darba līgumi vienuviet — vērtība, termiņi, izpilde, maksājumi un dokumenti"
        actions={options ? <NewContractDialog o={options} /> : undefined} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Spēkā esošie līgumi" value={current.length} sub={`${endingSoon} beidzas 60 d. laikā`} icon={<FileSignature className="h-4 w-4" />} href="/contracts" />
        <KpiCard label="Līgumu vērtība" value={Math.round(currentValue[0]?.[1] ?? 0)} suffix={currentValue[0] ? ` ${currentValue[0][0] === "EUR" ? "€" : currentValue[0][0]}` : " €"}
          sub={currentValue.length > 1 ? currentValue.slice(1).map(([c, v]) => fmtMoney(v, c, true)).join(" · ") : "spēkā esošajiem"} icon={<Banknote className="h-4 w-4" />} tone="wood" delay={40} />
        <KpiCard label="Sarunās" value={pipeline.length} sub={pipelineValue[0] ? fmtMoney(pipelineValue[0][1], pipelineValue[0][0], true) : "piedāvājumi, projekti"} icon={<Trees className="h-4 w-4" />} tone="info" href="/contracts?g=pipeline" delay={80} />
        <KpiCard label="Termiņi 14 dienās" value={dueSoon.length} sub={dueSoon[0] ? `${fmtDate(dueSoon[0].date)} · ${dueSoon[0].label}` : "nav steidzamu"} icon={<AlarmClock className="h-4 w-4" />} tone={dueSoon.some((d) => d.date < today) ? "crit" : dueSoon.length ? "warn" : "forest"} delay={120} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => <Chip key={g} href={qs({ g: g === "current" ? null : g })} active={group === g}>{GROUP_LABEL[g]}</Chip>)}
            <form method="get" className="relative ml-auto w-full sm:w-64">
              {group !== "current" && <input type="hidden" name="g" value={group} />}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={q} placeholder="Meklēt līgumu, klientu…" className="field pl-9" />
            </form>
          </div>

          {contractsRes.error ? (
            <Card><CardBody>
              <EmptyState icon={<FileSignature className="h-6 w-6" />} title="Sadaļa vēl tiek aktivizēta" text="Datubāzes atjauninājums līgumiem vēl nav uzlikts. Tiklīdz tas būs izdarīts, šeit varēs pievienot līgumus." />
            </CardBody></Card>
          ) : rows.length === 0 ? (
            <Card><CardBody>
              <EmptyState icon={<FileSignature className="h-6 w-6" />} title={all.length ? "Nekas netika atrasts" : "Vēl nav līgumu"}
                text={all.length ? "Maini filtru vai meklēšanas vārdu." : "Pievieno parakstītu līgumu vai izveido to no iegūtas iespējas (Klienti un darbi → Iespējas → „Līgums”)."} />
            </CardBody></Card>
          ) : (
            <ul className="space-y-3">
              {rows.map((c, i) => <ContractCard key={c.id} c={c} today={today} produced={c.project_id ? produced.get(c.project_id) ?? 0 : null} delay={i} />)}
            </ul>
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader title="Tuvākie termiņi" subtitle="Beigas, uzteikšana, nodošana, rēķini — 60 dienas" icon={<CalendarRange className="h-4 w-4" />} />
          <CardBody>
            {due.length === 0 ? <p className="text-sm text-muted">Tuvāko 60 dienu laikā termiņu nav.</p> : (
              <ul className="divide-y divide-line text-sm">
                {due.slice(0, 14).map((d, i) => {
                  const left = daysBetween(today, d.date);
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 py-2">
                      <Link href={`/contracts/${d.contractId}`} className="min-w-0 hover:text-amber">
                        <span className="block truncate font-medium text-ink">{d.label}</span>
                        <span className="block truncate text-xs text-muted">{d.contractTitle}{d.amount ? ` · ${fmtMoney(d.amount)}` : ""}</span>
                      </Link>
                      <span className={cn("shrink-0 text-right text-xs tabular", left < 0 ? "text-crit" : left <= 7 ? "text-warn" : "text-muted")}>
                        {fmtDate(d.date)}<br /><span className="text-[10px]">{left < 0 ? `nokavēts ${-left} d.` : left === 0 ? "šodien" : `pēc ${left} d.`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return <Link href={href} scroll={false} className={cn("rounded-xl border px-3 py-1.5 text-sm transition", active ? "border-forest-500/60 bg-forest-700 text-ink" : "border-line bg-surface text-muted hover:text-ink")}>{children}</Link>;
}

function Bar({ value, tone = "forest" }: { value: number; tone?: "forest" | "amber" | "crit" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={cn("h-full rounded-full", tone === "crit" ? "bg-crit" : tone === "amber" ? "bg-amber" : "bg-moss")} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

function ContractCard({ c, today, produced, delay }: { c: ContractListRow; today: string; produced: number | null; delay: number }) {
  const { value, estimated } = contractValue(c);
  const tp = timeProgress(c.start_date, c.end_date, today);
  const vp = c.volume_m3 && produced != null ? Math.round((produced / Number(c.volume_m3)) * 100) : null;
  const daysLeft = c.end_date ? daysBetween(today, c.end_date) : null;
  const live = c.status === "active" || c.status === "signed";
  const behind = live && tp != null && vp != null && vp + 15 < tp;
  return (
    <li className="card p-4 animate-fade-up" style={{ animationDelay: `${Math.min(delay, 12) * 25}ms` }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <Badge tone={CONTRACT_STATUS_TONE[c.status]} dot>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
            <span>{WORK_TYPE_LABEL[c.work_type as WorkType] ?? c.work_type}</span>
            {c.number && <span className="text-faint">· Nr. {c.number}</span>}
          </p>
          <Link href={`/contracts/${c.id}`} className="mt-1 block truncate text-[15px] font-semibold text-ink hover:text-amber">{c.title}</Link>
          <p className="truncate text-xs text-muted">
            {c.contact?.company_name ?? c.client_name ?? "Pasūtītājs nav norādīts"}
            {c.project && <> · <Link href={`/projects/${c.project.id}`} className="text-ink-2 hover:text-amber">{c.project.code}</Link></>}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-lg font-semibold tabular text-ink">{value != null ? fmtMoney(value, c.currency) : "—"}</p>
          <p className="text-[11px] text-muted">{estimated ? "aprēķināts" : c.unit_price != null ? `${fmtMoney(c.unit_price, c.currency)} ${c.pricing_model === "per_m3" ? "/m³" : c.pricing_model === "per_ha" ? "/ha" : ""}` : ""}</p>
        </div>
      </div>
      {(tp != null || vp != null) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tp != null && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</span>
                <span className={cn(daysLeft != null && daysLeft < 0 && live ? "text-crit" : daysLeft != null && daysLeft <= 30 && live ? "text-warn" : "")}>
                  {daysLeft == null ? "" : daysLeft < 0 ? `beidzās pirms ${-daysLeft} d.` : `${daysLeft} d. atlikušas`}
                </span>
              </div>
              <Bar value={tp} tone={daysLeft != null && daysLeft < 0 && live ? "crit" : "forest"} />
            </div>
          )}
          {vp != null && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>Izpilde: {fmtNumber(produced)} / {fmtNumber(c.volume_m3)} m³</span>
                <span className={behind ? "text-warn" : ""}>{vp}%{behind ? " · atpaliek" : ""}</span>
              </div>
              <Bar value={vp} tone={behind ? "amber" : "forest"} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
