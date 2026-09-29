import type { Metadata } from "next";
import { CalendarClock, Scale, Target, Trees, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, TabNav } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, STAGE_PROBABILITY, type LeadStatus } from "@/lib/forest/leads";
import { sp as one } from "@/lib/utils";
import { LeadPipeline, NewLeadDialog, type LeadRow } from "./lead-components";
import { fmtMoney } from "@/lib/forest/leads";
import { ForestWorkspace } from "./workspace";
import { OpportunityGuide } from "@/components/business/guide";

export const metadata: Metadata = { title: "Meža karte" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["map", "leads", "guide"] as const;
type Tab = (typeof TABS)[number];


export default async function ForestMapPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requirePermission("manage_projects", "view_finance");
  const sp = await searchParams;
  const tabParam = one(sp.tab) as Tab | undefined;
  const focusLead = one(sp.lead) ?? null;
  const focusMatch = (one(sp.focus) ?? "").match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  const focusPoint = focusMatch ? { lat: Number(focusMatch[1]), lng: Number(focusMatch[2]) } : null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "map";
  const canEdit = ctx.can("manage_projects");

  const [leadsRes, projectsRes] = await Promise.all([
    ctx.supabase.from("forest_leads")
      .select("id, title, status, source, work_type, country_id, company_id, project_id, latitude, longitude, area_ha, volume_m3, price_per_m3, estimated_value, currency, probability, cadastre_no, external_ref, owner_name, contact_phone, contact_email, next_action, next_action_at, notes, updated_at")
      .eq("organization_id", ctx.org.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    tab === "map"
      ? ctx.supabase.from("projects").select("id, code, name, status, latitude, longitude").eq("organization_id", ctx.org.id).is("deleted_at", null)
        .in("status", ["planned", "active", "paused"]).not("latitude", "is", null).not("longitude", "is", null)
      : Promise.resolve({ data: [] as { id: string; code: string; name: string; status: string; latitude: number | null; longitude: number | null }[] }),
  ]);
  const leads = (leadsRes.data ?? []) as LeadRow[];
  const countryCodes = Object.fromEntries(ctx.countries.map((c) => [c.id, c.code]));
  const countryIdByCode = Object.fromEntries(ctx.countries.map((c) => [c.code, c.id]));
  const countryOptions = ctx.countries.map((c) => ({ value: c.id, label: `${c.flag ?? ""} ${c.name}`.trim() }));
  const companyOptions = ctx.companies.map((c) => ({ value: c.id, label: c.name }));

  const open = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const weighted = open.reduce((a, l) => a + (l.estimated_value ?? 0) * ((l.probability ?? STAGE_PROBABILITY[l.status]) / 100), 0);
  const pipeline = open.reduce((a, l) => a + (l.estimated_value ?? 0), 0);
  const won = leads.filter((l) => l.status === "won").length;
  const closed = leads.filter((l) => l.status === "won" || l.status === "lost").length;
  const today = new Date().toISOString().slice(0, 10);
  const due = open.filter((l) => l.next_action_at && l.next_action_at <= today).length;
  const cur = leads[0]?.currency ?? "EUR";

  return (
    <>
      <PageHeader title="Meža karte" subtitle="Meži, kadastrs, cirtes un aizsargājamās teritorijas LV · SE · IS — un jaunu darbu iespējas"
        actions={canEdit ? <NewLeadDialog countries={countryOptions} companies={companyOptions} countryCodes={countryCodes} /> : undefined} />
      <TabNav active={tab} items={[
        { key: "map", label: "Karte", href: "/forest-map" },
        { key: "leads", label: "Iespējas", href: "/forest-map?tab=leads", count: open.length },
        { key: "guide", label: "Kā iegūt darbus", href: "/forest-map?tab=guide" },
      ]} />

      {tab === "map" && (
        <ForestWorkspace
          countries={ctx.countries.map((c) => c.code)} canEdit={canEdit} focusLead={focusLead} focusPoint={focusPoint}
          leads={leads.filter((l) => l.latitude != null && l.longitude != null).map((l) => ({
            id: l.id, title: l.title, status: l.status as LeadStatus, lat: l.latitude!, lng: l.longitude!,
            value: l.estimated_value != null ? fmtMoney(l.estimated_value, l.currency) : null,
            sub: [LEAD_SOURCE_LABEL[l.source as keyof typeof LEAD_SOURCE_LABEL], l.area_ha ? `${l.area_ha} ha` : null, l.volume_m3 ? `${Math.round(l.volume_m3)} m³` : null].filter(Boolean).join(" · "),
          }))}
          projects={(projectsRes.data ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, lat: p.latitude!, lng: p.longitude! }))}
          countryOptions={countryOptions} companyOptions={companyOptions} countryCodes={countryCodes} countryIdByCode={countryIdByCode} />
      )}

      {tab === "leads" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Atvērtās iespējas" value={open.length} icon={<Target className="h-4 w-4" />} />
            <KpiCard label="Portfeļa vērtība" value={Math.round(pipeline)} suffix={cur === "EUR" ? "€" : ` ${cur}`} icon={<Trees className="h-4 w-4" />} tone="wood" delay={40} />
            <KpiCard label="Svērtā prognoze" value={Math.round(weighted)} suffix={cur === "EUR" ? "€" : ` ${cur}`} sub="vērtība × varbūtība" icon={<TrendingUp className="h-4 w-4" />} tone="info" delay={80} />
            <KpiCard label="Uzvaru īpatsvars" value={closed ? Math.round((won / closed) * 100) : null} suffix="%" sub={due ? `${due} nokavēti soļi` : `${won} iegūtas`} icon={<Scale className="h-4 w-4" />} tone={due ? "warn" : "forest"} delay={120} />
          </div>
          {leads.length === 0 ? (
            <Card><CardBody className="py-10 text-center text-sm text-muted">
              Vēl nav iespēju. Atver <b>Karti</b>, ieslēdz slāni (piem. Zviedrijas ciršanas paziņojumus) un uzspied uz vietas → <b>Pievienot iespēju šeit</b>.
            </CardBody></Card>
          ) : (
            <LeadPipeline leads={leads} countries={countryOptions} companies={companyOptions} countryCodes={countryCodes} canEdit={canEdit} />
          )}
          {open.some((l) => l.next_action_at) && (
            <Card>
              <CardHeader title="Nākamie soļi" icon={<CalendarClock className="h-4 w-4" />} />
              <CardBody>
                <ul className="divide-y divide-line text-sm">
                  {open.filter((l) => l.next_action_at).sort((a, b) => a.next_action_at!.localeCompare(b.next_action_at!)).slice(0, 12).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0"><span className="block truncate font-medium text-ink">{l.next_action ?? l.title}</span><span className="block truncate text-xs text-muted">{l.title} · {LEAD_STATUS_LABEL[l.status as LeadStatus]}</span></span>
                      <span className={`shrink-0 text-xs ${l.next_action_at! < today ? "text-crit" : l.next_action_at === today ? "text-warn" : "text-muted"}`}>{l.next_action_at!.split("-").reverse().join(".")}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "guide" && <OpportunityGuide />}
    </>
  );
}
