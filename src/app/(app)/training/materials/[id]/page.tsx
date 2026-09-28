import type { Metadata } from "next";
import { BadgeCheck, CheckCircle2, ChevronLeft, CircleDashed, Clock, FileDown, History, Pencil, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { CategoryIcon } from "@/components/training/category-icon";
import { MaterialBlocks } from "@/components/training/material-blocks";
import { Badge } from "@/components/ui/badge";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY_META, inAudience } from "@/lib/training/categories";
import { parseBody, tableOfContents } from "@/lib/training/format";
import { loadAcks, loadAudience, relevantForMe, type MaterialRow } from "@/lib/training/materials";
import { cn } from "@/lib/utils";
import { AckForm, Toc } from "../components";

export const metadata: Metadata = { title: "Mācību materiāls" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireOrg();
  const canManage = ctx.can("manage_safety");

  const { data } = await ctx.supabase.from("training_materials").select("*").eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const m = data as unknown as MaterialRow;

  const blocks = parseBody(m.body);
  const toc = tableOfContents(blocks);
  const meta = CATEGORY_META[m.category] ?? CATEGORY_META.other;
  const color = meta.color;
  const country = ctx.countries.find((c) => c.id === m.country_id);
  const audienceLabel = m.audience.length ? m.audience.map((a) => ctx.label("materials.audiences", a)).join(", ") : ctx.t("materials.audienceAll");
  const labels = { do: ctx.t("materials.blocks.do"), dont: ctx.t("materials.blocks.dont"), crit: ctx.t("materials.blocks.crit"), warn: ctx.t("materials.blocks.warn"), tip: ctx.t("materials.blocks.tip") };

  const [myAcks, allAcks, audience] = await Promise.all([
    ctx.employee ? loadAcks(ctx, [m.id], { all: false }) : Promise.resolve([]),
    canManage ? loadAcks(ctx, [m.id], { all: true }) : Promise.resolve([]),
    canManage ? loadAudience(ctx) : Promise.resolve([]),
  ]);
  const myCurrent = myAcks.find((a) => a.version === m.version && a.employee_id === ctx.employee?.id) ?? null;
  const myPrevious = !myCurrent ? myAcks.filter((a) => a.employee_id === ctx.employee?.id).sort((a, b) => b.version - a.version)[0] ?? null : null;
  const needsAck = m.status === "published" && m.requires_acknowledgement;
  const relevant = relevantForMe(ctx, m);

  // Manager panel: audience members with / without an acknowledgement of the CURRENT version
  const people = audience.filter((p) => inAudience(m, p));
  const ackByEmp = new Map<string, { version: number; at: string }>();
  for (const a of allAcks) {
    const prev = ackByEmp.get(a.employee_id);
    if (!prev || a.version > prev.version) ackByEmp.set(a.employee_id, { version: a.version, at: a.acknowledged_at });
  }
  const done = people.filter((p) => ackByEmp.get(p.employee_id)?.version === m.version);
  const pending = people.filter((p) => ackByEmp.get(p.employee_id)?.version !== m.version);
  const pct = people.length ? (done.length / people.length) * 100 : 0;

  const cover = {
    "--cat": color,
    background: `radial-gradient(120% 140% at 100% 0%, ${color}33 0%, transparent 55%), linear-gradient(180deg, ${color}14, transparent 70%), var(--surface)`,
  } as CSSProperties;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/training" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-ink animate-fade-up">
        <ChevronLeft className="h-3.5 w-3.5" /> {ctx.t("materials.back")}
      </Link>

      {/* ---------------------------------------------------------------- cover */}
      <header className="topo-bg relative overflow-hidden rounded-[22px] border border-line shadow-[var(--shadow)] animate-fade-up" style={cover}>
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden />
        <div className="px-5 py-7 sm:px-9 sm:py-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ background: `${color}26`, color }}>
              <CategoryIcon category={m.category} className="h-3.5 w-3.5" />
              {ctx.label("materials.categories", m.category)}
            </span>
            {country ? <Badge tone="neutral">{country.flag} {country.name}</Badge> : <Badge tone="neutral">{ctx.t("materials.forAll")}</Badge>}
            {m.status === "draft" && <Badge tone="off">{ctx.t("materials.draft")}</Badge>}
            {needsAck && <Badge tone="amber"><ShieldAlert className="h-3 w-3" />{ctx.t("materials.pdf.requiresAck")}</Badge>}
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-[32px] font-bold uppercase leading-[1.02] tracking-wide text-ink sm:text-5xl">{m.title}</h1>
          {m.subtitle && <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-2 sm:text-lg">{m.subtitle}</p>}

          <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-3 text-sm">
            <Meta icon={<History className="h-4 w-4" />} label={ctx.t("materials.version")} value={`v${m.version}`} />
            <Meta icon={<CircleDashed className="h-4 w-4" />} label={m.status === "published" ? ctx.t("materials.published") : ctx.t("materials.updated")} value={fmtDate(m.published_at ?? m.updated_at, ctx.timezone)} />
            {m.reading_minutes && <Meta icon={<Clock className="h-4 w-4" />} label={ctx.t("materials.readingTime")} value={ctx.t("materials.minutes", { n: m.reading_minutes })} />}
            <Meta icon={<Users className="h-4 w-4" />} label={ctx.t("materials.audience")} value={audienceLabel} />
          </dl>

          <div className="mt-7 flex flex-wrap gap-2">
            <a href={`/api/training/${m.id}/pdf`} className={buttonClass("secondary", "md")} download>
              <FileDown className="h-4 w-4" />{ctx.t("materials.downloadPdf")}
            </a>
            {canManage && <ButtonLink href={`/training/materials/${m.id}/edit`} variant="outline"><Pencil className="h-4 w-4" />{ctx.t("materials.edit")}</ButtonLink>}
          </div>
        </div>
      </header>

      {m.status === "draft" && (
        <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{ctx.t("materials.draftNotice")}</p>
      )}

      {/* ---------------------------------------------------------------- document */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">
            {toc.length > 1 && <Toc entries={toc} title={ctx.t("materials.contents")} accent={color} />}
          </div>
        </aside>

        <div className="min-w-0 max-w-[860px] space-y-6">
          {toc.length > 1 && <Toc mobile entries={toc} title={ctx.t("materials.contents")} accent={color} />}

          {m.summary && (
            <div className="rounded-2xl border border-line bg-surface-2/60 px-5 py-4 sm:px-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>{ctx.t("materials.summary")}</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{m.summary}</p>
            </div>
          )}

          <article className="card px-5 py-7 sm:px-9 sm:py-10">
            <MaterialBlocks blocks={blocks} labels={labels} accent={color} />
          </article>

          {/* ------------------------------------------------------------ acknowledgement */}
          {needsAck && (
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:bottom-5">
              {!ctx.employee ? (
                <div className="rounded-2xl border border-line bg-surface/95 px-5 py-4 text-sm text-muted shadow-[var(--shadow)] backdrop-blur">{ctx.t("materials.noEmployee")}</div>
              ) : myCurrent ? (
                <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-surface/95 px-5 py-4 shadow-[var(--shadow)] backdrop-blur">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ok/15 text-ok"><BadgeCheck className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <div className="font-semibold text-ok">{ctx.t("materials.acknowledged")}</div>
                    <div className="text-sm text-muted">{ctx.t("materials.ackDone", { date: fmtDateTime(myCurrent.acknowledged_at, ctx.timezone) })} · v{m.version}</div>
                  </div>
                </div>
              ) : (
                <div className={cn("flex flex-col gap-3 rounded-2xl border bg-surface/95 px-5 py-4 shadow-[var(--shadow)] backdrop-blur sm:flex-row sm:items-center sm:justify-between",
                  relevant ? "border-amber/40" : "border-line")}>
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold text-ink">{relevant ? ctx.t("materials.mustRead") : ctx.t("materials.optionalRead")}</div>
                    <div className="text-muted">{myPrevious ? ctx.t("materials.ackPrevious", { n: myPrevious.version }) : ctx.t("materials.ackHint")}</div>
                  </div>
                  <AckForm materialId={m.id} version={m.version} />
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------ manager panel */}
          {canManage && needsAck && (
            <Card>
              <CardHeader title={ctx.t("materials.manager.title")} subtitle={ctx.t("materials.manager.subtitle")} icon={<Users className="h-4 w-4" />}
                action={people.length > 0 ? <span className="font-display text-2xl font-bold tabular text-ink">{Math.round(pct)} %</span> : undefined} />
              <CardBody className="space-y-5">
                {people.length === 0 ? (
                  <p className="text-sm text-muted">{ctx.t("materials.manager.noAudience")}</p>
                ) : (
                  <>
                    <div>
                      <div className="mb-1.5 text-xs text-muted">{ctx.t("materials.progress", { done: done.length, total: people.length })}</div>
                      <Progress className="h-2" value={pct} tone={done.length === people.length ? "forest" : "amber"} />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <PeopleList title={ctx.t("materials.manager.pending")} tone="pending" empty={ctx.t("materials.manager.none")}
                        items={pending.map((p) => {
                          const prev = ackByEmp.get(p.employee_id);
                          return { id: p.employee_id, name: p.full_name, note: prev ? ctx.t("materials.manager.outdated", { n: prev.version }) : null };
                        })} />
                      <PeopleList title={ctx.t("materials.manager.done")} tone="done" empty={ctx.t("materials.manager.none")}
                        items={done.map((p) => ({ id: p.employee_id, name: p.full_name, note: fmtDateTime(ackByEmp.get(p.employee_id)?.at, ctx.timezone) }))} />
                    </div>
                  </>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3/80 text-[var(--cat)]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
        <dd className="truncate font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

function PeopleList({ title, items, tone, empty }: { title: string; items: { id: string; name: string; note: string | null }[]; tone: "done" | "pending"; empty: string }) {
  return (
    <div>
      <div className={cn("mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", tone === "done" ? "text-ok" : "text-amber")}>
        {tone === "done" ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
        {title} <span className="tabular text-muted">({items.length})</span>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <Link href={`/employees/${i.id}`} className="min-w-0 truncate text-ink hover:text-amber">{i.name}</Link>
              {i.note && <span className="shrink-0 text-xs text-muted">{i.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
