import type { Metadata } from "next";
import { AlertCircle, ArrowRight, BookUser, CalendarClock, ExternalLink, Gavel, Globe, Mail, MapPin, Phone, RefreshCw, Search, Target, Trees, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OpportunityGuide } from "@/components/business/guide";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton, type FormAction } from "@/components/ui/form";
import { KpiCard } from "@/components/ui/kpi";
import { EmptyState, PageHeader, TabNav } from "@/components/ui/misc";
import { fetchFellingNotices, FELLING_TYPE_LV, SE_COUNTIES } from "@/lib/business/skogsstyrelsen";
import type { TenderNoticeRow } from "@/lib/business/iub";
import { TENDER_CATEGORY_LV, type TenderCategory } from "@/lib/business/tender-classify";
import { syncTendersIfStale } from "@/lib/business/tender-sync";
import type { TenderCountry } from "@/lib/business/ted";
import { requirePermission } from "@/lib/context";
import { STAGE_PROBABILITY } from "@/lib/forest/leads";
import { cn, sp as one } from "@/lib/utils";
import { fmtMoney, LeadPipeline, NewLeadDialog, type LeadRow } from "../forest-map/lead-components";
import { loadDirectory, refreshTenders } from "./actions";
import { AddLeadButton, CONTACT_KIND_LABEL, CONTACT_STATUS_LABEL, EditContactDialog, NewContactDialog, type ContactRow } from "./components";

export const metadata: Metadata = { title: "Klienti un darbi" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["overview", "tenders", "felling", "pipeline", "contacts", "guide"] as const;
type Tab = (typeof TABS)[number];
const FLAG: Record<string, string> = { LV: "🇱🇻", SE: "🇸🇪", IS: "🇮🇸" };

const fmtD = (d: string | null) => (d ? d.split("-").reverse().join(".") : "—");

export default async function BusinessPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission("manage_projects", "view_finance");
  const sp = await searchParams;
  const tabParam = one(sp.tab) as Tab | undefined;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview";
  const canEdit = ctx.can("manage_projects");
  const orgCountries = ctx.countries.map((c) => c.code).filter((c): c is TenderCountry => ["LV", "SE", "IS"].includes(c));

  // filters
  const tc = (one(sp.tc) ?? "").toUpperCase();
  const tenderCountries = (["LV", "SE", "IS"] as TenderCountry[]).includes(tc as TenderCountry) ? [tc as TenderCountry] : orgCountries.length ? orgCountries : (["LV", "SE", "IS"] as TenderCountry[]);
  const stage = (["open", "planning", "result", "all"] as const).find((x) => x === one(sp.st)) ?? "open";
  const cat = (Object.keys(TENDER_CATEGORY_LV) as TenderCategory[]).find((x) => x === one(sp.cat)) ?? null;
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const counties = (one(sp.lan) ?? "").split(",").filter((c) => /^\d{2}$/.test(c));
  const minHa = Math.max(0, Number(one(sp.minha) ?? 5) || 0);
  const fellType = one(sp.typ) && FELLING_TYPE_LV[one(sp.typ)!] ? one(sp.typ)! : "Föryngringsavverkning";

  const needTenders = tab === "overview" || tab === "tenders";
  const needFelling = (tab === "overview" || tab === "felling") && orgCountries.includes("SE");
  // refresh the shared tender cache when it is older than a few hours (bounded wait; continues next time)
  if (needTenders) await Promise.race([syncTendersIfStale(), new Promise((r) => setTimeout(r, 6_000))]);
  const nowIso = new Date().toISOString();
  const TENDER_COLS = "id, source, country, stage, notice_type, title, description, buyer_name, buyer_reg_no, buyer_city, buyer_email, buyer_phone, region, cpv, cpv_extra, category, score, nature, procedure, reference, published_on, deadline, duration_months, estimated_value, currency, url";
  const tenderQuery = () => {
    let tq = ctx.supabase.from("tender_notices").select(TENDER_COLS, { count: "exact" }).in("country", tenderCountries);
    if (tab === "overview" || stage === "open") tq = tq.eq("stage", "competition").or(`deadline.gte.${nowIso},deadline.is.null`);
    else if (stage === "planning") tq = tq.eq("stage", "planning");
    else if (stage === "result") tq = tq.eq("stage", "result");
    if (cat) tq = tq.eq("category", cat);
    if (q) { const safe = q.replace(/[%,()]/g, " "); tq = tq.or(`title.ilike.%${safe}%,buyer_name.ilike.%${safe}%,buyer_city.ilike.%${safe}%`); }
    return (tab === "overview" || stage === "open" ? tq.order("deadline", { ascending: true, nullsFirst: false }) : tq.order("published_on", { ascending: false })).limit(tab === "overview" ? 8 : 300);
  };
  const [tendersRes, awardsRes, stageCountsRes, syncRes, fellingRes, leadsRes, contactsRes] = await Promise.all([
    needTenders ? tenderQuery() : Promise.resolve({ data: [] as TenderNoticeRow[], count: 0, error: null }),
    tab === "overview" ? ctx.supabase.from("tender_notices").select(TENDER_COLS).in("country", tenderCountries).eq("stage", "result").order("published_on", { ascending: false }).limit(5) : Promise.resolve({ data: [] as TenderNoticeRow[] }),
    needTenders ? ctx.supabase.from("tender_notices").select("id", { count: "exact", head: true }).in("country", tenderCountries).eq("stage", "competition").or(`deadline.gte.${nowIso},deadline.is.null`) : Promise.resolve({ count: 0 }),
    needTenders ? ctx.supabase.from("tender_sync_state").select("source, last_day, last_run_at") : Promise.resolve({ data: [] as { source: string; last_day: string | null; last_run_at: string | null }[] }),
    needFelling ? fetchFellingNotices({ counties, minHa: tab === "overview" ? Math.max(minHa, 10) : minHa, type: fellType, limit: tab === "overview" ? 60 : 300 }) : Promise.resolve({ items: [] as import("@/lib/business/skogsstyrelsen").FellingNotice[], total: 0, error: undefined as string | undefined }),
    ctx.supabase.from("forest_leads")
      .select("id, title, status, source, work_type, country_id, company_id, project_id, latitude, longitude, area_ha, volume_m3, price_per_m3, estimated_value, currency, probability, cadastre_no, external_ref, owner_name, contact_phone, contact_email, next_action, next_action_at, notes, updated_at")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    ctx.supabase.from("business_contacts")
      .select("id, company_name, kind, status, country_id, contact_name, role, phone, email, website, notes, last_contact_at, next_action, next_action_at")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("company_name"),
  ]);
  const leads = (leadsRes.data ?? []) as LeadRow[];
  const contacts = (contactsRes.data ?? []) as ContactRow[];
  const leadRefs = new Set(leads.map((l) => l.external_ref).filter(Boolean));
  const today = new Date().toISOString().slice(0, 10);

  const tenders = (tendersRes.data ?? []) as TenderNoticeRow[];
  const tenderError = tendersRes.error ? "Iepirkumu datus neizdevās ielādēt" : undefined;
  const openCount = stageCountsRes.count ?? 0;
  const awards = (awardsRes.data ?? []) as TenderNoticeRow[];
  const lastSync = (syncRes.data ?? []).map((r) => r.last_run_at).filter(Boolean).sort().at(-1) ?? null;
  const felling = fellingRes.items;
  const openLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const weighted = openLeads.reduce((a, l) => a + (l.estimated_value ?? 0) * ((l.probability ?? STAGE_PROBABILITY[l.status]) / 100), 0);
  const overdue = [
    ...openLeads.filter((l) => l.next_action_at && l.next_action_at <= today).map((l) => ({ id: l.id, title: l.next_action ?? l.title, sub: l.title, at: l.next_action_at!, href: `/business?tab=pipeline` })),
    ...contacts.filter((c) => c.next_action_at && c.next_action_at <= today).map((c) => ({ id: c.id, title: c.next_action ?? c.company_name, sub: c.company_name, at: c.next_action_at!, href: `/business?tab=contacts` })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const countryOptions = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const companyOptions = ctx.companies.map((c) => ({ value: c.id, label: c.name }));
  const countryCodes = Object.fromEntries(ctx.countries.map((c) => [c.id, c.code]));
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
    for (const [k, v] of Object.entries(patch)) if (v == null) p.delete(k); else p.set(k, v);
    return `/business?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Klienti un darbi" subtitle="Valsts iepirkumi, jauni ciršanas pieteikumi, iespējas un kontakti — visās valstīs vienuviet"
        actions={canEdit ? <NewLeadDialog countries={countryOptions} companies={companyOptions} countryCodes={countryCodes} /> : undefined} />
      <TabNav active={tab} items={[
        { key: "overview", label: "Pārskats", href: "/business" },
        { key: "tenders", label: "Iepirkumi", href: "/business?tab=tenders", count: openCount || null },
        ...(orgCountries.includes("SE") ? [{ key: "felling", label: "Ciršanas pieteikumi (SE)", href: "/business?tab=felling" }] : []),
        { key: "pipeline", label: "Iespējas", href: "/business?tab=pipeline", count: openLeads.length || null },
        { key: "contacts", label: "Kontakti", href: "/business?tab=contacts", count: contacts.length || null },
        { key: "guide", label: "Kur meklēt darbus", href: "/business?tab=guide" },
      ]} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Atvērtie iepirkumi" value={openCount} sub="EIS/IUB + TED · meža darbi" icon={<Gavel className="h-4 w-4" />} href="/business?tab=tenders" />
            <KpiCard label="Jauni ciršanas pieteikumi" value={needFelling ? fellingRes.total : null} sub={needFelling ? "Zviedrija · ≥10 ha · 6 ned." : "tikai Zviedrijā"} icon={<Trees className="h-4 w-4" />} tone="wood" href="/business?tab=felling" delay={40} />
            <KpiCard label="Atvērtās iespējas" value={openLeads.length} sub={`prognoze ${fmtMoney(weighted, openLeads[0]?.currency ?? "EUR")}`} icon={<TrendingUp className="h-4 w-4" />} tone="info" href="/business?tab=pipeline" delay={80} />
            <KpiCard label="Nokavēti soļi" value={overdue.length} sub={`${contacts.length} kontakti`} icon={<CalendarClock className="h-4 w-4" />} tone={overdue.length ? "warn" : "forest"} href="/business?tab=contacts" delay={120} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Iepirkumi ar tuvāko termiņu" subtitle="Publiski konkursi mežizstrādē un mežkopībā" icon={<Gavel className="h-4 w-4" />}
                action={<Link href="/business?tab=tenders" className="text-xs text-amber hover:underline">Visi →</Link>} />
              <CardBody>
                {tenderError ? <SourceError text={tenderError} /> : tenders.length === 0 ? <p className="text-sm text-muted">Šobrīd nav atvērtu konkursu. Pārbaudi arī nacionālos portālus cilnē „Kur meklēt darbus”.</p> : (
                  <ul className="divide-y divide-line">
                    {tenders.slice(0, 6).map((t) => <TenderRow key={t.id} t={t} compact added={leadRefs.has(t.id) || leadRefs.has(`TED ${t.reference}`)} canEdit={canEdit} />)}
                  </ul>
                )}
              </CardBody>
            </Card>
            {needFelling ? (
              <Card>
                <CardHeader title="Lielākie jaunie ciršanas pieteikumi (SE)" subtitle="Īpašnieki, kuriem drīz vajadzēs darbuzņēmēju" icon={<Trees className="h-4 w-4" />}
                  action={<Link href="/business?tab=felling" className="text-xs text-amber hover:underline">Visi →</Link>} />
                <CardBody>
                  {fellingRes.error ? <SourceError text={fellingRes.error} /> : (
                    <ul className="divide-y divide-line">
                      {[...felling].sort((a, b) => b.ha - a.ha).slice(0, 6).map((f) => <FellingRow key={f.id} f={f} compact added={leadRefs.has(f.id)} canEdit={canEdit} />)}
                    </ul>
                  )}
                </CardBody>
              </Card>
            ) : (
              <Card><CardHeader title="Privātie darbi" icon={<Trees className="h-4 w-4" />} /><CardBody className="text-sm text-muted">Aktivizē Zviedriju iestatījumos, lai redzētu jaunos ciršanas pieteikumus.</CardBody></Card>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Jādara šodien" subtitle="Nākamie soļi, kuru termiņš ir pienācis" icon={<AlertCircle className="h-4 w-4" />} />
              <CardBody>
                {overdue.length === 0 ? <p className="text-sm text-muted">Viss izdarīts — nav nokavētu soļu.</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {overdue.slice(0, 8).map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={o.href} className="min-w-0 hover:text-amber"><span className="block truncate font-medium text-ink">{o.title}</span><span className="block truncate text-xs text-muted">{o.sub}</span></Link>
                        <span className={cn("shrink-0 text-xs", o.at < today ? "text-crit" : "text-warn")}>{fmtD(o.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Kam pēdējā laikā piešķirti līgumi" subtitle="Rezultāti parāda cenas un konkurentus" icon={<Target className="h-4 w-4" />} />
              <CardBody>
                {awards.length === 0 ? <p className="text-sm text-muted">Nav nesenu rezultātu.</p> : (
                  <ul className="divide-y divide-line">{awards.slice(0, 5).map((t) => <TenderRow key={t.id} t={t} compact canEdit={false} />)}</ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === "tenders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {([["open", "Atvērtie konkursi"], ["planning", "Plānotie (agrīnie signāli)"], ["result", "Rezultāti"], ["all", "Visi"]] as const).map(([k, label]) => (
              <Chip key={k} href={qs({ st: k === "open" ? null : k })} active={stage === k}>{label}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[{ k: null, label: "Visas valstis" }, ...(["LV", "SE", "IS"] as const).map((c) => ({ k: c, label: `${FLAG[c]} ${c}` }))].map((o) => (
              <Chip key={o.label} href={qs({ tc: o.k })} active={(o.k ?? "") === tc}>{o.label}</Chip>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <Chip href={qs({ cat: null })} active={!cat}>Visi darbi</Chip>
            {(Object.entries(TENDER_CATEGORY_LV) as [TenderCategory, string][]).filter(([k]) => k !== "other").map(([k, label]) => (
              <Chip key={k} href={qs({ cat: k })} active={cat === k}>{label}</Chip>
            ))}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="tab" value="tenders" />
            {stage !== "open" && <input type="hidden" name="st" value={stage} />}
            {tc && <input type="hidden" name="tc" value={tc} />}
            {cat && <input type="hidden" name="cat" value={cat} />}
            <label className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input name="q" defaultValue={q} placeholder="Meklēt: pasūtītājs, novads, darbs…" className="field pl-9" />
            </label>
            <button className="h-10 rounded-xl border border-line px-4 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">Meklēt</button>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted">
              {lastSync && <span>Atjaunots {new Date(lastSync).toLocaleString("lv-LV", { timeZone: ctx.timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
              <ActionButton action={refreshTenders as FormAction} variant="ghost" size="sm"><RefreshCw className="h-4 w-4" /> Atjaunot</ActionButton>
            </span>
          </form>
          <Card>
            <CardBody className="pt-4">
              {tenderError ? <SourceError text={tenderError} /> : tenders.length === 0 ? (
                <EmptyState icon={<Gavel className="h-6 w-6" />} title={q || cat ? "Nekas netika atrasts" : "Nav atvērtu konkursu"}
                  text="Sistēma katru dienu pārlūko visus Latvijas publiskos iepirkumus (IUB/EIS — pašvaldības, LVM, valsts iestādes) un ES TED paziņojumus. Zviedrijas un Islandes mazākos konkursus skaties e-Avrop, TendSign un Útboðsvefur (cilne „Kur meklēt darbus”)." />
              ) : (
                <ul className="divide-y divide-line">{tenders.map((t) => <TenderRow key={t.id} t={t} added={leadRefs.has(t.id) || leadRefs.has(`TED ${t.reference}`)} canEdit={canEdit} />)}</ul>
              )}
              <p className="mt-4 text-[11px] text-faint">
                Avoti: Iepirkumu uzraudzības birojs — atvērtie dati (visi Latvijas iepirkumi, arī zem ES robežvērtības) un TED (ES). Atlasīti pēc CPV kodiem 772*, 7734*, 0341* un atslēgvārdiem (mežizstrāde, cirsmas, bīstamo koku zāģēšana, apaugums, jaunaudžu kopšana, kokmateriāli, šķelda). Atjaunojas automātiski.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "felling" && needFelling && (
        <div className="space-y-4">
          <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="tab" value="felling" />
            <label className="text-xs text-muted">Län (reģions)
              <select name="lan" defaultValue={counties[0] ?? ""} className="field mt-1 w-48">
                <option value="">Visa Zviedrija</option>
                {SE_COUNTIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">Min. platība
              <select name="minha" defaultValue={String(minHa)} className="field mt-1 w-32">
                {[0, 2, 5, 10, 20, 50].map((h) => <option key={h} value={h}>{h ? `≥ ${h} ha` : "jebkura"}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">Cirtes veids
              <select name="typ" defaultValue={fellType} className="field mt-1 w-72">
                {Object.entries(FELLING_TYPE_LV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button className="h-10 rounded-xl bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-500">Rādīt</button>
            <p className="basis-full text-xs text-muted">
              Atrasti <b className="text-ink">{fellingRes.total}</b> pieteikumi pēdējās 6 nedēļās. Īpašnieka kontaktus var pieprasīt Skogsstyrelsen kā publisku dokumentu (allmän handling), norādot pieteikuma numuru.
            </p>
          </form>
          <Card>
            <CardBody className="pt-4">
              {fellingRes.error ? <SourceError text={fellingRes.error} /> : felling.length === 0 ? <p className="text-sm text-muted">Nekas netika atrasts ar šiem filtriem.</p> : (
                <ul className="divide-y divide-line">{felling.map((f) => <FellingRow key={f.id} f={f} added={leadRefs.has(f.id)} canEdit={canEdit} />)}</ul>
              )}
              <p className="mt-4 text-[11px] text-faint">Avots: Skogsstyrelsen, avverkningsanmälningar (CC0). Atjaunojas ik pēc 3 stundām.</p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "pipeline" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Velc kartītes starp posmiem. Iespēju ar pogu „Līgums” pārvērt par līgumu (sadaļa <Link href="/contracts" className="text-amber hover:underline">Līgumi</Link>), ar „Uz objektu” — par darba objektu. Iespējas redzamas arī <Link href="/forest-map" className="text-amber hover:underline">Meža kartē</Link>.</p>
          {leads.length === 0 ? <EmptyState icon={<Target className="h-6 w-6" />} title="Vēl nav iespēju" text="Pievieno no iepirkumiem, ciršanas pieteikumiem vai meža kartes." />
            : <LeadPipeline leads={leads} countries={countryOptions} companies={companyOptions} countryCodes={countryCodes} canEdit={canEdit} />}
        </div>
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Pasūtītāji, pircēji, meža īpašnieki un partneri. Katram vari ierakstīt nākamo soli un termiņu.</p>
            {canEdit && (
              <div className="flex gap-2">
                <ActionButton action={loadDirectory as FormAction} variant="secondary"><BookUser className="h-4 w-4" /> Ielādēt tirgus dalībniekus</ActionButton>
                <NewContactDialog countries={countryOptions} />
              </div>
            )}
          </div>
          {contacts.length === 0 ? (
            <EmptyState icon={<BookUser className="h-6 w-6" />} title="Kontaktu vēl nav" text="Ielādē galvenos tirgus dalībniekus (LVM, Södra, SCA, Holmen, Land og skógur u.c.) vai pievieno savus klientus." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {contacts.map((c, i) => {
                const country = ctx.countries.find((x) => x.id === c.country_id);
                return (
                  <div key={c.id} className="card flex flex-col p-4 animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{c.company_name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {country && <span>{country.flag} {country.code}</span>}
                          <Badge tone="neutral">{CONTACT_KIND_LABEL[c.kind] ?? c.kind}</Badge>
                          <Badge tone={c.status === "active" ? "ok" : c.status === "contacted" ? "info" : c.status === "inactive" ? "off" : "amber"}>{CONTACT_STATUS_LABEL[c.status] ?? c.status}</Badge>
                        </p>
                      </div>
                      {canEdit && <EditContactDialog c={c} countries={countryOptions} />}
                    </div>
                    {(c.contact_name || c.role) && <p className="mt-2 text-sm text-ink-2">{[c.contact_name, c.role].filter(Boolean).join(" · ")}</p>}
                    {c.notes && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">{c.notes}</p>}
                    <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs">
                      {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Phone className="h-3.5 w-3.5" />{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Mail className="h-3.5 w-3.5" />{c.email}</a>}
                      {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Globe className="h-3.5 w-3.5" />{safeHost(c.website)}</a>}
                    </div>
                    {c.next_action && (
                      <p className={cn("mt-2 rounded-lg border px-2 py-1 text-xs", c.next_action_at && c.next_action_at <= today ? "border-crit/30 bg-crit/5 text-crit" : "border-line text-muted")}>
                        → {c.next_action}{c.next_action_at ? ` · ${fmtD(c.next_action_at)}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "guide" && <OpportunityGuide countries={orgCountries.length ? orgCountries : undefined} />}
    </>
  );
}

function safeHost(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} scroll={false} className={cn("rounded-xl border px-3 py-1.5 text-sm transition", active ? "border-forest-500/60 bg-forest-700 text-ink" : "border-line bg-surface text-muted hover:text-ink")}>{children}</Link>
  );
}

function SourceError({ text }: { text: string }) {
  return <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">{text}. Mēģini vēlāk — avots īslaicīgi neatbild.</p>;
}

const STAGE_LABEL: Record<string, string> = { competition: "Konkurss", planning: "Plānots", result: "Rezultāts", other: "Cits" };

function TenderRow({ t, compact, added, canEdit }: { t: TenderNoticeRow; compact?: boolean; added?: boolean; canEdit: boolean }) {
  const dl = t.deadline ? t.deadline.slice(0, 10) : null;
  const left = t.deadline ? Math.ceil((Date.parse(t.deadline) - Date.now()) / 86_400_000) : null;
  const dlTime = t.deadline ? new Date(t.deadline).toLocaleTimeString("lv-LV", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span>{FLAG[t.country] ?? t.country}</span>
          <Badge tone={t.stage === "result" ? "off" : t.stage === "planning" ? "info" : "amber"}>{STAGE_LABEL[t.stage] ?? t.stage}</Badge>
          <Badge tone="neutral">{TENDER_CATEGORY_LV[t.category as TenderCategory] ?? t.category}</Badge>
          <span>{t.source === "iub" ? "EIS" : "TED"} · publicēts {fmtD(t.published_on)}</span>
          {t.reference && !compact && <span className="text-faint">· {t.reference}</span>}
        </p>
        <a href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" className={cn("mt-1 block font-medium text-ink hover:text-amber", compact ? "line-clamp-1 text-sm" : "line-clamp-2")}>{t.title}</a>
        <p className="truncate text-xs text-muted">
          {t.buyer_name ?? "—"}{t.buyer_city ? `, ${t.buyer_city}` : ""}
          {t.estimated_value ? ` · ${fmtMoney(t.estimated_value, t.currency ?? "EUR")}` : ""}
          {t.duration_months ? ` · ${t.duration_months} mēn.` : ""}
        </p>
        {!compact && (t.buyer_email || t.buyer_phone) && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
            {t.buyer_email && <a href={`mailto:${t.buyer_email}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Mail className="h-3 w-3" />{t.buyer_email}</a>}
            {t.buyer_phone && <a href={`tel:${t.buyer_phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Phone className="h-3 w-3" />{t.buyer_phone}</a>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {t.stage !== "result" && dl && (
          <span className={cn("whitespace-nowrap rounded-lg border px-2 py-1 text-xs tabular", left != null && left < 0 ? "border-line text-faint" : left != null && left <= 7 ? "border-crit/40 text-crit" : "border-line text-ink-2")}
            title={`Piedāvājumu termiņš ${fmtD(dl)} ${dlTime ?? ""}`}>
            {left != null && left >= 0 ? `${left} d. · ${fmtD(dl)}` : `beidzās ${fmtD(dl)}`}
          </span>
        )}
        {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t.source === "iub" ? "Atvērt EIS" : "Atvērt TED"}><ExternalLink className="h-4 w-4" /></a>}
        {canEdit && t.stage !== "result" && (
          <AddLeadButton added={added} fields={{
            title: `Iepirkums: ${t.title}`.slice(0, 200), source: "tender", external_ref: t.id.slice(0, 100), country: t.country,
            estimated_value: t.estimated_value ? String(t.estimated_value) : "", currency: t.currency ?? "", next_action_at: dl ?? "",
            notes: [t.buyer_name, t.reference, t.buyer_email, t.buyer_phone, t.url].filter(Boolean).join("\n").slice(0, 2000),
          }} />
        )}
      </div>
    </li>
  );
}

function FellingRow({ f, compact, added, canEdit }: { f: import("@/lib/business/skogsstyrelsen").FellingNotice; compact?: boolean; added?: boolean; canEdit: boolean }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] text-muted">🇸🇪 {f.county} · {f.municipality} · iesniegts {fmtD(f.filed)}</p>
        <p className={cn("mt-0.5 font-medium text-ink", compact && "text-sm")}>
          <span className="tabular text-amber">{f.ha.toLocaleString("lv-LV")} ha</span> · {f.typeLv}
        </p>
        <p className="text-xs text-muted">{f.id}{!compact && ` · ${f.forestTypeLv} · ${f.status}`}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {f.lat != null && f.lng != null && (
          <Link href={`/forest-map?focus=${f.lat.toFixed(5)},${f.lng.toFixed(5)}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">
            <MapPin className="h-3.5 w-3.5" /> Kartē <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {canEdit && (
          <AddLeadButton added={added} fields={{
            title: `${f.typeLv}: ${f.municipality}, ${f.ha} ha`.slice(0, 200), source: "felling_notice", external_ref: f.id, country: "SE",
            latitude: f.lat != null ? String(f.lat) : "", longitude: f.lng != null ? String(f.lng) : "", area_ha: String(f.ha),
            notes: `Skogsstyrelsen ${f.id} (${f.county}, ${f.municipality}), iesniegts ${f.filed}. Īpašnieka kontaktus pieprasīt Skogsstyrelsen.`,
          }} />
        )}
      </div>
    </li>
  );
}
