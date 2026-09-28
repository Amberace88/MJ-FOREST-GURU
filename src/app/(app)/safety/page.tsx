import type { Metadata } from "next";
import { CheckCircle2, History, RefreshCcw, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { EmptyState, PageHeader, Progress, SectionTitle, TabNav } from "@/components/ui/misc";
import type { OrgContext } from "@/lib/context";
import { requireOrg } from "@/lib/context";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn, sp as one } from "@/lib/utils";
import { fetchAll } from "../analytics/fetch-all";
import { acknowledgeRule } from "./actions";
import { EditRuleDialog, NewRuleDialog, NewVersionDialog, SAFETY_SECTIONS } from "./components";

export const metadata: Metadata = { title: "Drošība" };

type Rule = {
  id: string; section: string; title: string; country_id: string | null; current_version: number;
  requires_acknowledgement: boolean; is_active: boolean; sort_order: number;
};
type Version = { id: string; rule_id: string; version: number; body: string; created_at: string };

async function loadRules(ctx: OrgContext, scopeCountry: string | null) {
  const { data } = await ctx.supabase.from("safety_rules")
    .select("id, section, title, country_id, current_version, requires_acknowledgement, is_active, sort_order")
    .eq("organization_id", ctx.org.id).order("sort_order").order("title");
  return ((data ?? []) as Rule[]).filter((r) => !scopeCountry || !r.country_id || r.country_id === scopeCountry);
}

export default async function SafetyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const canManage = ctx.can("manage_safety");
  const tab = canManage && one(sp.tab) === "coverage" ? "coverage" : "rules";
  const scopeCountry = ctx.countryId ?? (canManage ? null : ctx.employee?.country_id ?? null);
  const countries = ctx.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }));

  return (
    <>
      <PageHeader title={ctx.t("safety.title")} subtitle={ctx.t("safety.subtitle")}
        actions={canManage && <NewRuleDialog countries={countries} defaultOpen={one(sp.new) === "1"} />} />

      <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber/35 bg-amber/[0.07] px-4 py-3.5 text-sm text-ink animate-fade-up">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
        <p className="leading-relaxed">{ctx.t("safety.disclaimer")}</p>
      </div>

      {canManage && (
        <TabNav active={tab} items={[
          { key: "rules", label: ctx.t("safety.tabs.rules"), href: "/safety" },
          { key: "coverage", label: ctx.t("safety.tabs.coverage"), href: "/safety?tab=coverage" },
        ]} />
      )}

      {tab === "coverage" ? <Coverage ctx={ctx} scopeCountry={scopeCountry} /> : <Rules ctx={ctx} scopeCountry={scopeCountry} canManage={canManage} countries={countries} />}
    </>
  );
}

/* ------------------------------------------------------------------ rules + acknowledgement */
async function Rules({ ctx, scopeCountry, canManage, countries }: {
  ctx: OrgContext; scopeCountry: string | null; canManage: boolean; countries: { id: string; name: string; flag: string | null }[];
}) {
  const rules = (await loadRules(ctx, scopeCountry)).filter((r) => r.is_active || canManage);
  if (!rules.length) {
    return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={ctx.t("safety.empty")} action={canManage ? <NewRuleDialog countries={countries} /> : undefined} />;
  }
  const ids = rules.map((r) => r.id);
  const [versionsRes, acksRes] = await Promise.all([
    ctx.supabase.from("safety_rule_versions").select("id, rule_id, version, body, created_at").in("rule_id", ids).order("version", { ascending: false }),
    ctx.employee
      ? ctx.supabase.from("safety_acknowledgements").select("rule_id, rule_version_id, version, acknowledged_at").eq("employee_id", ctx.employee.id)
      : Promise.resolve({ data: [] as { rule_id: string; rule_version_id: string; version: number; acknowledged_at: string }[] }),
  ]);
  const versions = (versionsRes.data ?? []) as Version[];
  const byRule = new Map<string, Version[]>();
  for (const v of versions) byRule.set(v.rule_id, [...(byRule.get(v.rule_id) ?? []), v]);
  const acks = acksRes.data ?? [];

  const required = rules.filter((r) => r.is_active && r.requires_acknowledgement);
  const currentAck = (r: Rule) => {
    const v = byRule.get(r.id)?.find((x) => x.version === r.current_version);
    return v ? acks.find((a) => a.rule_version_id === v.id) ?? null : null;
  };
  const doneCount = required.filter((r) => currentAck(r)).length;
  const sections = SAFETY_SECTIONS.filter((s) => rules.some((r) => r.section === s));

  return (
    <div className="space-y-8">
      {ctx.employee && required.length > 0 && (
        <Card className="topo-bg overflow-hidden p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("safety.myProgress")}</div>
              <div className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">
                {doneCount === required.length ? <span className="text-ok">{ctx.t("safety.allDone")}</span> : ctx.t("safety.progressText", { done: doneCount, total: required.length })}
              </div>
            </div>
            <span className="font-display text-4xl font-bold tabular text-ink">{Math.round((doneCount / required.length) * 100)} %</span>
          </div>
          <Progress className="mt-4 h-2" value={(doneCount / required.length) * 100} tone={doneCount === required.length ? "forest" : "amber"} />
        </Card>
      )}
      {!ctx.employee && !canManage && (
        <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{ctx.t("safety.noEmployee")}</p>
      )}

      {sections.length > 1 && (
        <nav aria-label={ctx.t("safety.jumpTo")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {sections.map((s) => (
            <a key={s} href={`#section-${s}`} className="whitespace-nowrap rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink">
              {ctx.label("safety.sections", s)}
            </a>
          ))}
        </nav>
      )}

      {sections.map((s) => (
        <section key={s} id={`section-${s}`} className="scroll-mt-24">
          <SectionTitle>{ctx.label("safety.sections", s)}</SectionTitle>
          <ul className="grid gap-4 xl:grid-cols-2">
            {rules.filter((r) => r.section === s).map((r, i) => {
              const history = byRule.get(r.id) ?? [];
              const current = history.find((v) => v.version === r.current_version) ?? null;
              const ack = currentAck(r);
              const previousAck = !ack ? acks.filter((a) => a.rule_id === r.id).sort((a, b) => b.version - a.version)[0] ?? null : null;
              const country = ctx.countries.find((c) => c.id === r.country_id);
              return (
                <li key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                  <Card className={cn("flex h-full flex-col", ack && "border-ok/25", !r.is_active && "opacity-70")}>
                    <CardHeader
                      title={r.title}
                      subtitle={current ? ctx.t("safety.publishedAt", { date: fmtDate(current.created_at, ctx.timezone) }) : undefined}
                      icon={ack ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <ShieldCheck className="h-4 w-4" />}
                      action={
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {country && <Badge tone="neutral">{country.flag} {country.code}</Badge>}
                          <Badge tone="forest">{ctx.t("safety.version")} {r.current_version}</Badge>
                          {!r.is_active && <Badge tone="off">{ctx.t("safety.inactive")}</Badge>}
                        </div>
                      }
                    />
                    <CardBody className="flex flex-1 flex-col gap-4">
                      <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-2/50 p-4 text-sm leading-relaxed text-ink-2">
                        {current?.body ?? <span className="text-muted">{ctx.t("common.noData")}</span>}
                      </div>

                      <div className="mt-auto space-y-3">
                        {!r.requires_acknowledgement ? (
                          <p className="text-xs text-muted">{ctx.t("safety.noAckRequired")}</p>
                        ) : ack ? (
                          <div className="flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/[0.08] px-3.5 py-2.5 text-sm text-ok">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>{ctx.t("safety.acknowledgedOn", { date: fmtDateTime(ack.acknowledged_at, ctx.timezone) })}</span>
                          </div>
                        ) : ctx.employee && current && r.is_active ? (
                          <div className="space-y-2">
                            {previousAck && (
                              <p className="flex items-center gap-2 text-xs text-warn">
                                <RefreshCcw className="h-3.5 w-3.5" /> {ctx.t("safety.reackRequired")} · {ctx.t("safety.previousVersionAck", { version: previousAck.version })}
                              </p>
                            )}
                            <ActionButton action={acknowledgeRule.bind(null, r.id, current.id)} variant="amber" size="lg" className="w-full whitespace-normal text-left sm:w-auto">
                              <CheckCircle2 className="h-5 w-5" /> {ctx.t("safety.acknowledge")}
                            </ActionButton>
                          </div>
                        ) : (
                          <Badge tone="warn">{ctx.t("safety.notAcknowledged")}</Badge>
                        )}

                        {canManage && (
                          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                            <NewVersionDialog ruleId={r.id} title={r.title} version={r.current_version} body={current?.body ?? ""} />
                            <EditRuleDialog countries={countries} values={r} />
                            {history.length > 1 && (
                              <details className="group w-full text-sm">
                                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted hover:text-ink">
                                  <History className="h-3.5 w-3.5" /> {ctx.t("safety.versionHistory")} ({history.length})
                                </summary>
                                <ol className="mt-2 space-y-2">
                                  {history.map((v) => (
                                    <li key={v.id} className="rounded-lg border border-line bg-surface-2/40 p-3">
                                      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                                        <Badge tone={v.version === r.current_version ? "forest" : "off"}>v{v.version}</Badge>
                                        {fmtDateTime(v.created_at, ctx.timezone)}
                                      </div>
                                      <p className="line-clamp-4 whitespace-pre-wrap text-xs text-ink-2">{v.body}</p>
                                    </li>
                                  ))}
                                </ol>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ coverage (manage_safety) */
async function Coverage({ ctx, scopeCountry }: { ctx: OrgContext; scopeCountry: string | null }) {
  const rules = (await loadRules(ctx, scopeCountry)).filter((r) => r.is_active && r.requires_acknowledgement);
  if (!rules.length) return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={ctx.t("safety.empty")} />;

  let eq = ctx.supabase.from("employees").select("id, full_name, country_id")
    .eq("organization_id", ctx.org.id).is("deleted_at", null).is("archived_at", null).eq("status", "active").not("user_id", "is", null).order("full_name");
  if (scopeCountry) eq = eq.eq("country_id", scopeCountry);
  const { data: versions } = await ctx.supabase.from("safety_rule_versions").select("id, rule_id, version").in("rule_id", rules.map((r) => r.id));
  const currentIds = rules.map((r) => (versions ?? []).find((v) => v.rule_id === r.id && v.version === r.current_version)?.id).filter((x): x is string => Boolean(x));
  const [employeesRes, acks] = await Promise.all([
    eq,
    currentIds.length
      ? fetchAll((a, b) => ctx.supabase.from("safety_acknowledgements").select("rule_version_id, employee_id, acknowledged_at")
          .eq("organization_id", ctx.org.id).in("rule_version_id", currentIds).range(a, b), 50000)
      : Promise.resolve({ rows: [] as { rule_version_id: string; employee_id: string; acknowledged_at: string }[] }),
  ]);
  const employees = employeesRes.data ?? [];
  const ackMap = new Map<string, Map<string, string>>();
  for (const a of acks.rows) {
    const m = ackMap.get(a.rule_version_id) ?? new Map<string, string>();
    m.set(a.employee_id, a.acknowledged_at);
    ackMap.set(a.rule_version_id, m);
  }

  const stats = rules.map((r) => {
    const vid = (versions ?? []).find((v) => v.rule_id === r.id && v.version === r.current_version)?.id;
    const applicable = employees.filter((e) => !r.country_id || e.country_id === r.country_id);
    const m = (vid && ackMap.get(vid)) || new Map<string, string>();
    const acked = applicable.filter((e) => m.has(e.id));
    const pending = applicable.filter((e) => !m.has(e.id));
    return { rule: r, applicable, acked, pending, m, pct: applicable.length ? (acked.length / applicable.length) * 100 : null };
  });
  const totalApplicable = stats.reduce((a, s) => a + s.applicable.length, 0);
  const totalAcked = stats.reduce((a, s) => a + s.acked.length, 0);
  const overall = totalApplicable ? (totalAcked / totalApplicable) * 100 : null;
  const fullyDone = employees.filter((e) => stats.every((s) => !s.applicable.includes(e) || s.m.has(e.id))).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-5 md:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("safety.overall")}</div>
              <div className="mt-1 font-display text-4xl font-bold tabular">{overall === null ? "—" : `${Math.round(overall)} %`}</div>
            </div>
            <span className="text-sm text-muted tabular">{totalAcked} / {totalApplicable}</span>
          </div>
          <Progress className="mt-4 h-2" value={overall ?? 0} tone={overall !== null && overall >= 90 ? "forest" : overall !== null && overall >= 60 ? "amber" : "crit"} />
          <p className="mt-3 text-xs text-faint">{ctx.t("safety.coverageHint")}</p>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("safety.allDone")}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular">{fullyDone}</span>
            <span className="text-sm text-muted">/ {employees.length} <Users className="inline h-3.5 w-3.5" /></span>
          </div>
        </Card>
      </div>

      {SAFETY_SECTIONS.filter((s) => stats.some((x) => x.rule.section === s)).map((s) => (
        <section key={s}>
          <SectionTitle>{ctx.label("safety.sections", s)}</SectionTitle>
          <Card>
            <ul className="divide-y divide-line/70">
              {stats.filter((x) => x.rule.section === s).map((x) => (
                <li key={x.rule.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{x.rule.title}</span>
                        <Badge tone="forest">v{x.rule.current_version}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{ctx.t("safety.acknowledgedCount", { done: x.acked.length, total: x.applicable.length })}</div>
                    </div>
                    <span className={cn("font-display text-2xl font-bold tabular", x.pct === 100 ? "text-ok" : x.pct !== null && x.pct < 60 ? "text-crit" : "text-ink")}>
                      {x.pct === null ? "—" : `${Math.round(x.pct)} %`}
                    </span>
                  </div>
                  <Progress className="mt-2" value={x.pct ?? 0} tone={x.pct === 100 ? "forest" : x.pct !== null && x.pct < 60 ? "crit" : "amber"} />
                  {x.applicable.length === 0 ? (
                    <p className="mt-2 text-xs text-faint">{ctx.t("safety.noEmployees")}</p>
                  ) : (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                        {ctx.t("safety.pendingList")}: <span className={x.pending.length ? "text-warn" : "text-ok"}>{x.pending.length}</span>
                        {" · "}{ctx.t("safety.acknowledgedList")}: {x.acked.length}
                      </summary>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-warn">{ctx.t("safety.pendingList")}</h3>
                          {x.pending.length ? (
                            <ul className="flex flex-wrap gap-1.5">
                              {x.pending.map((e) => <li key={e.id}><Badge tone="warn">{e.full_name}</Badge></li>)}
                            </ul>
                          ) : <p className="text-xs text-ok">{ctx.t("safety.allDone")}</p>}
                        </div>
                        <div>
                          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ok">{ctx.t("safety.acknowledgedList")}</h3>
                          <ul className="space-y-1 text-xs">
                            {x.acked.map((e) => (
                              <li key={e.id} className="flex justify-between gap-3">
                                <span className="text-ink-2">{e.full_name}</span>
                                <span className="tabular text-muted">{fmtDateTime(x.m.get(e.id), ctx.timezone)}</span>
                              </li>
                            ))}
                            {!x.acked.length && <li className="text-muted">—</li>}
                          </ul>
                        </div>
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
