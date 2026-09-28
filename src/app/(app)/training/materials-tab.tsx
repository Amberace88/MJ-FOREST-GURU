import { BookOpenCheck, CheckCircle2, Clock, Users } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CategoryIcon } from "@/components/training/category-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import type { OrgContext } from "@/lib/context";
import { CATEGORY_META, isCategory, sortByCategory } from "@/lib/training/categories";
import {
  loadAcks, loadAudience, MATERIAL_LIST_COLUMNS, progressFor, relevantForMe, syncBuiltins, type AckRow, type MaterialListRow, type Progress as P,
} from "@/lib/training/materials";
import { MATERIAL_CATEGORIES } from "@/lib/training/types";
import { cn, sp as one } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

function href(patch: { cat?: string | null; country?: string | null }, sp: SP) {
  const u = new URLSearchParams();
  const cat = patch.cat === undefined ? one(sp.cat) : patch.cat;
  const country = patch.country === undefined ? one(sp.country) : patch.country;
  if (cat) u.set("cat", cat);
  if (country) u.set("country", country);
  const s = u.toString();
  return `/training${s ? `?${s}` : ""}`;
}

export async function MaterialsTab({ ctx, sp }: { ctx: OrgContext; sp: SP }) {
  const canManage = ctx.can("manage_safety");
  if (canManage) await syncBuiltins(ctx);

  const { data } = await ctx.supabase.from("training_materials").select(MATERIAL_LIST_COLUMNS)
    .eq("organization_id", ctx.org.id).is("deleted_at", null).order("title");
  const all = sortByCategory((data ?? []) as MaterialListRow[]);

  const catParam = one(sp.cat);
  const cat = isCategory(catParam) ? catParam : null;
  const countryParam = one(sp.country);
  const countryFilter = countryParam === "all" ? "all" : ctx.countries.find((c) => c.id === countryParam)?.id ?? null;
  // Scope: explicit filter › global country switch › (employees) own country
  const scopeCountry = countryFilter === "all" ? null : countryFilter ?? ctx.countryId ?? (canManage ? null : ctx.employee?.country_id ?? null);
  const scoped = all.filter((m) => !scopeCountry || !m.country_id || m.country_id === scopeCountry);
  const rows = scoped.filter((m) => !cat || m.category === cat);

  const ids = all.map((m) => m.id);
  const [myAcks, allAcks, audience] = await Promise.all([
    ctx.employee ? loadAcks(ctx, ids, { all: false }) : Promise.resolve([] as AckRow[]),
    canManage ? loadAcks(ctx, ids, { all: true }) : Promise.resolve([] as AckRow[]),
    loadAudience(ctx),
  ]);
  const myAck = (m: MaterialListRow) => myAcks.find((a) => a.material_id === m.id && a.version === m.version && a.employee_id === ctx.employee?.id) ?? null;

  const required = ctx.employee ? scoped.filter((m) => m.status === "published" && m.requires_acknowledgement && relevantForMe(ctx, m)) : [];
  const doneCount = required.filter((m) => myAck(m)).length;

  if (!all.length) {
    return <EmptyState icon={<BookOpenCheck className="h-6 w-6" />} title={canManage ? ctx.t("materials.empty") : ctx.t("materials.emptyEmployee")} />;
  }

  const categories = MATERIAL_CATEGORIES.filter((c) => scoped.some((m) => m.category === c));
  const grouped = categories.filter((c) => !cat || c === cat).map((c) => ({ cat: c, items: rows.filter((m) => m.category === c) })).filter((g) => g.items.length);
  const countriesUsed = ctx.countries.filter((c) => all.some((m) => m.country_id === c.id));

  return (
    <div className="space-y-7">
      {required.length > 0 && (
        <Card className="topo-bg overflow-hidden p-5 animate-fade-up">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ctx.t("materials.myProgress")}</div>
              <div className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">
                {doneCount === required.length
                  ? <span className="inline-flex items-center gap-2 text-ok"><CheckCircle2 className="h-6 w-6" />{ctx.t("materials.allDone")}</span>
                  : ctx.t("materials.myProgressText", { done: doneCount, total: required.length })}
              </div>
            </div>
            <span className="font-display text-4xl font-bold tabular text-ink">{Math.round((doneCount / required.length) * 100)} %</span>
          </div>
          <Progress className="mt-4 h-2" value={(doneCount / required.length) * 100} tone={doneCount === required.length ? "forest" : "amber"} />
        </Card>
      )}

      <p className="max-w-3xl text-sm text-muted">{ctx.t("materials.libraryIntro")}</p>

      <div className="space-y-3">
        <nav aria-label={ctx.t("materials.category")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip href={href({ cat: null }, sp)} active={!cat}>{ctx.t("materials.allCategories")}<Count n={scoped.length} /></Chip>
          {categories.map((c) => (
            <Chip key={c} href={href({ cat: c }, sp)} active={cat === c} color={CATEGORY_META[c].color}>
              <CategoryIcon category={c} className="h-3.5 w-3.5" />
              {ctx.label("materials.categories", c)}
              <Count n={scoped.filter((m) => m.category === c).length} />
            </Chip>
          ))}
        </nav>
        {countriesUsed.length > 0 && (
          <nav aria-label={ctx.t("materials.country")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip small href={href({ country: "all" }, sp)} active={!scopeCountry}>{ctx.t("materials.allCountries")}</Chip>
            {countriesUsed.map((c) => (
              <Chip small key={c.id} href={href({ country: c.id }, sp)} active={scopeCountry === c.id}>{c.flag} {c.name}</Chip>
            ))}
          </nav>
        )}
      </div>

      {grouped.length === 0 && <EmptyState title={ctx.t("materials.noResults")} />}

      {grouped.map((g, gi) => (
        <section key={g.cat} id={`cat-${g.cat}`} className="scroll-mt-24">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${CATEGORY_META[g.cat].color}22`, color: CATEGORY_META[g.cat].color }}>
              <CategoryIcon category={g.cat} className="h-4 w-4" />
            </span>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">{ctx.label("materials.categories", g.cat)}</h2>
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {g.items.map((m, i) => (
              <li key={m.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(gi * 2 + i, 10) * 40}ms` }}>
                <MaterialCard ctx={ctx} m={m} acked={Boolean(myAck(m))} relevant={Boolean(ctx.employee) && relevantForMe(ctx, m)}
                  progress={canManage && m.status === "published" && m.requires_acknowledgement ? progressFor(m, audience, allAcks) : null} canManage={canManage} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-surface-3 px-1.5 text-[10px] tabular text-ink-2">{n}</span>;
}

function Chip({ href: to, active, children, color, small }: { href: string; active: boolean; children: React.ReactNode; color?: string; small?: boolean }) {
  return (
    <Link href={to} scroll={false} aria-current={active ? "true" : undefined}
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border transition-colors",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        active ? "border-line-strong bg-surface-3 text-ink shadow-[inset_0_-2px_0_var(--chip,var(--amber))]" : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink")}
      style={color ? ({ "--chip": color } as CSSProperties) : undefined}>
      {children}
    </Link>
  );
}

function MaterialCard({ ctx, m, acked, relevant, progress, canManage }: {
  ctx: OrgContext; m: MaterialListRow; acked: boolean; relevant: boolean; progress: P | null; canManage: boolean;
}) {
  const color = CATEGORY_META[m.category]?.color ?? CATEGORY_META.other.color;
  const country = ctx.countries.find((c) => c.id === m.country_id);
  const audience = m.audience.length ? m.audience.map((a) => ctx.label("materials.audiences", a)).join(", ") : ctx.t("materials.audienceAll");
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;
  return (
    <Link href={`/training/materials/${m.id}`}
      className={cn("card card-hover group relative flex h-full flex-col overflow-hidden p-5 focus-visible:outline-offset-4", m.status === "draft" && "border-dashed")}
      style={{ "--cat": color } as CSSProperties}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }} aria-hidden />
      <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]" style={{ background: color }} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-105"
          style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}>
          <CategoryIcon category={m.category} className="h-5 w-5" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {country && <Badge tone="neutral" title={country.name}>{country.flag} {country.code}</Badge>}
          {m.status === "draft" && <Badge tone="off">{ctx.t("materials.draft")}</Badge>}
          {canManage && m.builtin_key && <Badge tone={m.is_customized ? "wood" : "forest"}>{m.is_customized ? ctx.t("materials.customized") : ctx.t("materials.builtin")}</Badge>}
        </div>
      </div>

      <h3 className="mt-4 line-clamp-2 text-[17px] font-semibold leading-snug text-ink group-hover:text-ink">{m.title}</h3>
      {(m.subtitle || m.summary) && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">{m.subtitle || m.summary}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        {m.reading_minutes && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{ctx.t("materials.minutes", { n: m.reading_minutes })}</span>}
        <span className="tabular">{ctx.t("materials.versionShort", { n: m.version })}</span>
        <span className="inline-flex min-w-0 items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{audience}</span></span>
      </div>

      <div className="mt-auto space-y-3 pt-4">
        {m.status === "published" && m.requires_acknowledgement && relevant && (
          acked
            ? <Badge tone="ok" className="px-2.5 py-1 text-xs"><CheckCircle2 className="h-3.5 w-3.5" />{ctx.t("materials.acknowledged")}</Badge>
            : <Badge tone="amber" dot pulse className="px-2.5 py-1 text-xs">{ctx.t("materials.mustRead")}</Badge>
        )}
        {progress && (
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted">{progress.total ? ctx.t("materials.progress", { done: progress.done, total: progress.total }) : ctx.t("materials.progressNone")}</span>
              {progress.total > 0 && <span className="font-semibold tabular text-ink">{Math.round(pct)} %</span>}
            </div>
            <Progress value={pct} tone={progress.total && progress.done === progress.total ? "forest" : pct >= 50 ? "amber" : "warn"} />
          </div>
        )}
      </div>
    </Link>
  );
}
