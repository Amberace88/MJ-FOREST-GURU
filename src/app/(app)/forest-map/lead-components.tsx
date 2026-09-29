"use client";

import { ArrowRight, FileSignature, Pencil, Plus, Trash2, TreePine } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, Textarea, type FormAction } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import {
  fmtMoney,
  LEAD_SOURCE_LABEL, LEAD_SOURCES, LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, LEAD_STATUSES, LEAD_WORK_LABEL, LEAD_WORK_TYPES,
  STAGE_PROBABILITY, type LeadStatus,
} from "@/lib/forest/leads";
import { cn } from "@/lib/utils";
import { contractFromLead } from "../contracts/actions";
import { convertLeadToProject, createLead, deleteLead, setLeadStatus, updateLead } from "./actions";

export type LeadRow = {
  id: string; title: string; status: LeadStatus; source: string; work_type: string | null;
  country_id: string | null; company_id: string | null; project_id: string | null;
  latitude: number | null; longitude: number | null; area_ha: number | null; volume_m3: number | null; price_per_m3: number | null;
  estimated_value: number | null; currency: string; probability: number | null;
  cadastre_no: string | null; external_ref: string | null; owner_name: string | null; contact_phone: string | null; contact_email: string | null;
  next_action: string | null; next_action_at: string | null; notes: string | null; updated_at: string;
};
export type Opt = { value: string; label: string };

const CURRENCY_BY_COUNTRY: Record<string, string> = { LV: "EUR", SE: "SEK", IS: "ISK" };


function LeadFields({ lead, countries, companies, point, countryCodes }: {
  lead?: LeadRow; countries: Opt[]; companies: Opt[]; point?: { lat: number; lng: number; countryId?: string | null }; countryCodes: Record<string, string>;
}) {
  const [country, setCountry] = useState(lead?.country_id ?? point?.countryId ?? countries[0]?.value ?? "");
  const [volume, setVolume] = useState(lead?.volume_m3?.toString() ?? "");
  const [price, setPrice] = useState(lead?.price_per_m3?.toString() ?? "");
  const [currency, setCurrency] = useState(lead?.currency ?? CURRENCY_BY_COUNTRY[countryCodes[country] ?? ""] ?? "EUR");
  const est = Number(volume) > 0 && Number(price) > 0 ? Number(volume) * Number(price) : null;
  return (
    <div className="space-y-4">
      <Input name="title" label="Nosaukums" defaultValue={lead?.title} required maxLength={200} placeholder="piem. Kailcirte, Ērgļu pag., 12 ha" autoFocus />
      <FormGrid cols={3}>
        <Select name="status" label="Statuss" defaultValue={lead?.status ?? "new"} options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
        <Select name="source" label="Avots" defaultValue={lead?.source ?? (point ? "map" : "other")} options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] }))} />
        <Select name="work_type" label="Darba veids" placeholder="—" defaultValue={lead?.work_type ?? ""} options={LEAD_WORK_TYPES.map((s) => ({ value: s, label: LEAD_WORK_LABEL[s] }))} />
      </FormGrid>
      <FormGrid cols={2}>
        <Select name="country_id" label="Valsts" value={country} onChange={(e) => { setCountry(e.target.value); const c = CURRENCY_BY_COUNTRY[countryCodes[e.target.value] ?? ""]; if (c && !lead) setCurrency(c); }} options={countries} />
        {companies.length > 0
          ? <Select name="company_id" label="Uzņēmums" placeholder="—" defaultValue={lead?.company_id ?? ""} options={companies} />
          : <div />}
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="area_ha" label="Platība, ha" type="number" step="0.01" min={0} defaultValue={lead?.area_ha ?? ""} optional />
        <Input name="volume_m3" label="Apjoms, m³" type="number" step="0.1" min={0} value={volume} onChange={(e) => setVolume(e.target.value)} optional />
        <Input name="price_per_m3" label={`Cena par m³ (${currency})`} type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} optional />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="estimated_value" label="Vērtība" type="number" step="1" min={0} defaultValue={lead?.estimated_value ?? ""} placeholder={est ? String(Math.round(est)) : ""}
          hint={est ? `Aprēķins: ${fmtMoney(est, currency)}` : "tukšs = apjoms × cena"} optional />
        <Select name="currency" label="Valūta" value={currency} onChange={(e) => setCurrency(e.target.value)} options={["EUR", "SEK", "ISK", "NOK", "USD"].map((c) => ({ value: c, label: c }))} />
        <Input name="probability" label="Varbūtība, %" type="number" min={0} max={100} defaultValue={lead?.probability ?? ""} placeholder="pēc posma" optional />
      </FormGrid>
      <FormGrid cols={2}>
        <Input name="latitude" label="Platums (lat)" type="number" step="any" defaultValue={lead?.latitude ?? point?.lat?.toFixed(6) ?? ""} optional />
        <Input name="longitude" label="Garums (lng)" type="number" step="any" defaultValue={lead?.longitude ?? point?.lng?.toFixed(6) ?? ""} optional />
        <Input name="cadastre_no" label="Kadastra nr. / fastighet" defaultValue={lead?.cadastre_no ?? ""} maxLength={100} optional />
        <Input name="external_ref" label="Ārējā atsauce" hint="piem. avverkningsanmälan nr., EIS id" defaultValue={lead?.external_ref ?? ""} maxLength={100} optional />
      </FormGrid>
      <FormGrid cols={3}>
        <Input name="owner_name" label="Īpašnieks / klients" defaultValue={lead?.owner_name ?? ""} maxLength={200} optional />
        <Input name="contact_phone" label="Tālrunis" type="tel" defaultValue={lead?.contact_phone ?? ""} maxLength={50} optional />
        <Input name="contact_email" label="E-pasts" type="email" defaultValue={lead?.contact_email ?? ""} maxLength={200} optional />
      </FormGrid>
      <FormGrid cols={2}>
        <Input name="next_action" label="Nākamais solis" defaultValue={lead?.next_action ?? ""} maxLength={300} placeholder="piem. piezvanīt īpašniekam" optional />
        <Input name="next_action_at" label="Līdz" type="date" defaultValue={lead?.next_action_at ?? ""} optional />
      </FormGrid>
      <Textarea name="notes" label="Piezīmes" defaultValue={lead?.notes ?? ""} rows={3} maxLength={5000} optional />
    </div>
  );
}

/** Opens programmatically (map click) or via its own button. */
export function NewLeadDialog({ countries, companies, countryCodes, openRef, point, trigger = true }: {
  countries: Opt[]; companies: Opt[]; countryCodes: Record<string, string>;
  openRef?: React.MutableRefObject<(() => void) | null>; point?: { lat: number; lng: number; countryId?: string | null } | null; trigger?: boolean;
}) {
  return (
    <FormDialog size="lg" title="Jauna iespēja" description="Potenciāls darbs / klients — vieta, apjoms, kontakti un nākamais solis."
      action={createLead as FormAction} successMessage="Iespēja pievienota"
      trigger={(open) => { if (openRef) openRef.current = open; return trigger ? <Button onClick={open}><Plus className="h-4 w-4" /> Jauna iespēja</Button> : null; }}>
      <LeadFields key={point ? `${point.lat},${point.lng}` : "new"} countries={countries} companies={companies} point={point ?? undefined} countryCodes={countryCodes} />
    </FormDialog>
  );
}

export function EditLeadDialog({ lead, countries, companies, countryCodes, openRef, iconOnly }: {
  lead: LeadRow; countries: Opt[]; companies: Opt[]; countryCodes: Record<string, string>; openRef?: React.MutableRefObject<(() => void) | null>; iconOnly?: boolean;
}) {
  return (
    <FormDialog size="lg" title={lead.title} description="Rediģēt iespēju" action={updateLead.bind(null, lead.id) as FormAction}
      trigger={(open) => { if (openRef) openRef.current = open; return <Button size="sm" variant="ghost" onClick={open} aria-label="Rediģēt"><Pencil className="h-4 w-4" />{!iconOnly && <span className="hidden md:inline">Rediģēt</span>}</Button>; }}>
      <LeadFields lead={lead} countries={countries} companies={companies} countryCodes={countryCodes} />
    </FormDialog>
  );
}

export function LeadActions({ lead }: { lead: LeadRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      {(lead.status === "offer" || lead.status === "won") && (
        <ActionButton action={contractFromLead.bind(null, lead.id) as FormAction} variant="ghost" size="sm">
          <FileSignature className="h-4 w-4" /><span className="hidden lg:inline">Līgums</span>
        </ActionButton>
      )}
      {lead.project_id ? (
        <Link href={`/projects/${lead.project_id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ok hover:bg-surface-2"><TreePine className="h-3.5 w-3.5" /> Objekts</Link>
      ) : lead.status !== "lost" ? (
        <ActionButton action={convertLeadToProject.bind(null, lead.id) as FormAction} variant="ghost" size="sm" confirm="Izveidot darba objektu no šīs iespējas (statuss → Iegūta)?">
          <ArrowRight className="h-4 w-4" /><span className="hidden lg:inline">Uz objektu</span>
        </ActionButton>
      ) : null}
      <ActionButton action={deleteLead.bind(null, lead.id) as FormAction} variant="ghost" size="sm" confirm="Dzēst šo iespēju?" className="text-muted hover:text-crit">
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </span>
  );
}

/** Kanban-style pipeline; drag a card to another column (or use the menu on touch). */
export function LeadPipeline({ leads, countries, companies, countryCodes, canEdit }: {
  leads: LeadRow[]; countries: Opt[]; companies: Opt[]; countryCodes: Record<string, string>; canEdit: boolean;
}) {
  const [items, setItems] = useState(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [, start] = useTransition();
  const prev = useRef(leads);
  if (prev.current !== leads) { prev.current = leads; setItems(leads); }

  const move = (id: string, status: LeadStatus) => {
    const before = items;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    start(async () => {
      const r = await setLeadStatus(id, status);
      if (!r.ok) { setItems(before); toast(r.error ?? "Kļūda", "error"); }
    });
  };

  return (
    <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
      {LEAD_STATUSES.map((s) => {
        const col = items.filter((l) => l.status === s);
        const total = col.reduce((a, l) => a + (l.estimated_value ?? 0), 0);
        return (
          <section key={s}
            onDragOver={(e) => { if (canEdit && dragId) { e.preventDefault(); setOver(s); } }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (dragId) move(dragId, s); setDragId(null); }}
            className={cn("min-h-40 rounded-2xl border bg-surface/60 p-2 transition", over === s ? "border-amber/60 bg-amber/5" : "border-line")}>
            <header className="mb-2 flex items-center justify-between gap-2 px-1.5 pt-1">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: LEAD_STATUS_COLOR[s] }} />{LEAD_STATUS_LABEL[s]}
                <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">{col.length}</span>
              </span>
              {total > 0 && <span className="text-[11px] text-muted">{fmtMoney(total, col[0]?.currency)}</span>}
            </header>
            <ul className="space-y-2">
              {col.map((l, i) => (
                <li key={l.id} draggable={canEdit} onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)} style={{ animationDelay: `${i * 30}ms` }}
                  className={cn("group rounded-xl border border-line bg-surface p-3 shadow-sm transition animate-fade-up hover:border-line-strong", canEdit && "cursor-grab active:cursor-grabbing", dragId === l.id && "opacity-50")}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/forest-map?lead=${l.id}`} className="min-w-0 text-sm font-medium text-ink hover:text-amber">
                      <span className="line-clamp-2">{l.title}</span>
                    </Link>
                    {canEdit && <EditLeadDialog lead={l} countries={countries} companies={companies} countryCodes={countryCodes} iconOnly />}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    {l.estimated_value != null && <span className="font-medium text-ink-2">{fmtMoney(l.estimated_value, l.currency)}</span>}
                    {l.volume_m3 != null && <span>{Math.round(l.volume_m3)} m³</span>}
                    {l.area_ha != null && <span>{l.area_ha} ha</span>}
                    <span>{l.probability ?? STAGE_PROBABILITY[l.status]}%</span>
                  </div>
                  {l.next_action && (
                    <p className={cn("mt-1.5 truncate text-[11px]", l.next_action_at && l.next_action_at < new Date().toISOString().slice(0, 10) && l.status !== "won" && l.status !== "lost" ? "text-crit" : "text-faint")}>
                      → {l.next_action}{l.next_action_at ? ` · ${l.next_action_at.split("-").reverse().join(".")}` : ""}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex items-center justify-between gap-1 border-t border-line pt-1.5 md:hidden">
                      <select value={l.status} onChange={(e) => move(l.id, e.target.value as LeadStatus)} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2" aria-label="Statuss">
                        {LEAD_STATUSES.map((x) => <option key={x} value={x}>{LEAD_STATUS_LABEL[x]}</option>)}
                      </select>
                      <LeadActions lead={l} />
                    </div>
                  )}
                  {canEdit && <div className="mt-1 hidden justify-end md:group-hover:flex"><LeadActions lead={l} /></div>}
                </li>
              ))}
              {col.length === 0 && <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-faint">—</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
