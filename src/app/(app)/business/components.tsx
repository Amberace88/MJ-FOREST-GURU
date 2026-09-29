"use client";

import { BookmarkPlus, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import { addLeadFrom, createContact, deleteContact, updateContact } from "./actions";

export const CONTACT_KIND_LABEL: Record<string, string> = {
  client: "Pasūtītājs", buyer: "Kokmateriālu pircējs", forest_owner: "Meža īpašnieks", agency: "Valsts iestāde",
  contractor: "Partneris / apakšuzņēmējs", association: "Asociācija", portal: "Iepirkumu portāls", other: "Cits",
};
export const CONTACT_STATUS_LABEL: Record<string, string> = { prospect: "Potenciāls", contacted: "Sazināts", active: "Aktīvs klients", inactive: "Neaktīvs" };

export type ContactRow = {
  id: string; company_name: string; kind: string; status: string; country_id: string | null; contact_name: string | null; role: string | null;
  phone: string | null; email: string | null; website: string | null; notes: string | null; last_contact_at: string | null;
  next_action: string | null; next_action_at: string | null;
};

function ContactFields({ c, countries }: { c?: ContactRow; countries: Option[] }) {
  return (
    <div className="space-y-4">
      <Input name="company_name" label="Uzņēmums / organizācija" defaultValue={c?.company_name} required maxLength={200} autoFocus />
      <FormGrid cols={3}>
        <Select name="kind" label="Veids" defaultValue={c?.kind ?? "client"} options={Object.entries(CONTACT_KIND_LABEL).map(([value, label]) => ({ value, label }))} />
        <Select name="status" label="Statuss" defaultValue={c?.status ?? "prospect"} options={Object.entries(CONTACT_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <Select name="country_id" label="Valsts" placeholder="—" defaultValue={c?.country_id ?? ""} options={countries} />
      </FormGrid>
      <FormGrid cols={2}>
        <Input name="contact_name" label="Kontaktpersona" defaultValue={c?.contact_name ?? ""} maxLength={200} optional />
        <Input name="role" label="Amats" defaultValue={c?.role ?? ""} maxLength={120} optional />
        <Input name="phone" type="tel" label="Tālrunis" defaultValue={c?.phone ?? ""} maxLength={50} placeholder="+371 …" optional />
        <Input name="email" type="email" label="E-pasts" defaultValue={c?.email ?? ""} maxLength={200} optional />
      </FormGrid>
      <Input name="website" label="Mājaslapa" defaultValue={c?.website ?? ""} maxLength={300} placeholder="https://" optional />
      <FormGrid cols={3}>
        <Input name="last_contact_at" type="date" label="Pēdējais kontakts" defaultValue={c?.last_contact_at ?? ""} optional />
        <Input name="next_action" label="Nākamais solis" defaultValue={c?.next_action ?? ""} maxLength={300} optional />
        <Input name="next_action_at" type="date" label="Līdz" defaultValue={c?.next_action_at ?? ""} optional />
      </FormGrid>
      <Textarea name="notes" label="Piezīmes" defaultValue={c?.notes ?? ""} rows={3} maxLength={5000} optional />
    </div>
  );
}

export function NewContactDialog({ countries }: { countries: Option[] }) {
  return (
    <FormDialog size="lg" title="Jauns kontakts" description="Klients, pircējs, meža īpašnieks vai partneris." action={createContact as FormAction}
      trigger={<Button><Plus className="h-4 w-4" /> Jauns kontakts</Button>}>
      <ContactFields countries={countries} />
    </FormDialog>
  );
}

export function EditContactDialog({ c, countries }: { c: ContactRow; countries: Option[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <FormDialog size="lg" title={c.company_name} description="Rediģēt kontaktu" action={updateContact.bind(null, c.id) as FormAction}
        trigger={<Button size="sm" variant="ghost" aria-label="Rediģēt"><Pencil className="h-4 w-4" /></Button>}>
        <ContactFields c={c} countries={countries} />
      </FormDialog>
      <ActionButton action={deleteContact.bind(null, c.id) as FormAction} variant="ghost" size="sm" className="text-muted hover:text-crit" confirm={`Dzēst ${c.company_name}?`}>
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </span>
  );
}

/** "→ Iespējas" for a tender or a felling notice (deduplicated on the server). */
export function AddLeadButton({ fields, added }: { fields: Record<string, string>; added?: boolean }) {
  const [done, setDone] = useState(Boolean(added));
  if (done) return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs text-ok"><Check className="h-3.5 w-3.5" /> Iespējās</span>;
  return (
    <span onClick={() => setTimeout(() => setDone(true), 900)}>
      <ActionButton action={addLeadFrom as FormAction} fields={fields} variant="secondary" size="sm">
        <BookmarkPlus className="h-4 w-4" /><span className="hidden sm:inline">Uz iespējām</span>
      </ActionButton>
    </span>
  );
}
