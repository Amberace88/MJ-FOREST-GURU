"use client";

import { Check, FilePlus2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton, FormDialog, FormGrid, Input, Select, Textarea, type FormAction, type Option } from "@/components/ui/form";
import {
  CONTRACT_SOURCE_LABEL, CONTRACT_STATUS_LABEL, CURRENCIES, MILESTONE_KIND_LABEL, PRICING_LABEL, WORK_TYPE_LABEL,
} from "@/lib/contracts";
import { addMilestone, createContract, removeMilestone, toggleMilestone, updateContract } from "./actions";

export type ContractFormRow = {
  id: string; title: string; number: string | null; client_name: string | null; contact_id: string | null; country_id: string | null;
  company_id: string | null; project_id: string | null; work_type: string; source: string; status: string; signed_at: string | null;
  start_date: string | null; end_date: string | null; notice_date: string | null; pricing_model: string; unit_price: number | null;
  total_value: number | null; currency: string; volume_m3: number | null; area_ha: number | null; payment_terms_days: number | null;
  guarantee: string | null; penalties: string | null; external_ref: string | null; location: string | null; notes: string | null;
};

export type ContractOptions = { countries: Option[]; companies: Option[]; contacts: Option[]; projects: Option[] };

const opts = (m: Record<string, string>): Option[] => Object.entries(m).map(([value, label]) => ({ value, label }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function ContractFields({ c, o }: { c?: ContractFormRow; o: ContractOptions }) {
  const v = (x: number | null | undefined) => (x == null ? "" : String(x));
  return (
    <div className="space-y-6">
      <Section title="Pamatdati">
        <Input name="title" label="Nosaukums / darbs" defaultValue={c?.title} required maxLength={200} autoFocus placeholder="piem. Kailcirte, Ogres novads, 12 ha" />
        <FormGrid cols={3}>
          <Input name="number" label="Līguma nr." defaultValue={c?.number ?? ""} maxLength={100} optional />
          <Select name="work_type" label="Darba veids" defaultValue={c?.work_type ?? "harvesting"} options={opts(WORK_TYPE_LABEL)} />
          <Select name="source" label="Avots" defaultValue={c?.source ?? "private"} options={opts(CONTRACT_SOURCE_LABEL)} />
        </FormGrid>
        <FormGrid cols={3}>
          <Select name="status" label="Statuss" defaultValue={c?.status ?? "negotiation"} options={opts(CONTRACT_STATUS_LABEL)} />
          <Select name="country_id" label="Valsts" placeholder="—" defaultValue={c?.country_id ?? ""} options={o.countries} />
          {o.companies.length > 1
            ? <Select name="company_id" label="Mūsu uzņēmums" placeholder="—" defaultValue={c?.company_id ?? ""} options={o.companies} />
            : <input type="hidden" name="company_id" value={c?.company_id ?? o.companies[0]?.value ?? ""} />}
        </FormGrid>
      </Section>

      <Section title="Pasūtītājs">
        <FormGrid cols={2}>
          <Input name="client_name" label="Pasūtītājs" defaultValue={c?.client_name ?? ""} maxLength={200} optional placeholder="piem. AS Latvijas valsts meži" />
          <Select name="contact_id" label="Kontakts no saraksta" placeholder="—" defaultValue={c?.contact_id ?? ""} options={o.contacts} optional />
        </FormGrid>
        <FormGrid cols={2}>
          <Input name="location" label="Vieta" defaultValue={c?.location ?? ""} maxLength={300} optional placeholder="novads, kvartāls, kadastrs" />
          <Select name="project_id" label="Darba objekts" placeholder="— vēl nav —" defaultValue={c?.project_id ?? ""} options={o.projects} optional />
        </FormGrid>
      </Section>

      <Section title="Termiņi">
        <FormGrid cols={2}>
          <Input name="signed_at" type="date" label="Parakstīts" defaultValue={c?.signed_at ?? ""} optional />
          <Input name="notice_date" type="date" label="Pagarināt / uzteikt līdz" defaultValue={c?.notice_date ?? ""} optional hint="Atgādinājums pirms termiņa" />
          <Input name="start_date" type="date" label="Sākums" defaultValue={c?.start_date ?? ""} optional />
          <Input name="end_date" type="date" label="Beigas" defaultValue={c?.end_date ?? ""} optional />
        </FormGrid>
      </Section>

      <Section title="Cena un apjoms">
        <FormGrid cols={3}>
          <Select name="pricing_model" label="Cenas veids" defaultValue={c?.pricing_model ?? "per_m3"} options={opts(PRICING_LABEL)} />
          <Input name="unit_price" type="number" step="0.01" min="0" label="Vienības cena" defaultValue={v(c?.unit_price)} optional />
          <Select name="currency" label="Valūta" defaultValue={c?.currency ?? "EUR"} options={CURRENCIES.map((x) => ({ value: x, label: x }))} />
        </FormGrid>
        <FormGrid cols={3}>
          <Input name="volume_m3" type="number" step="0.1" min="0" label="Apjoms, m³" defaultValue={v(c?.volume_m3)} optional />
          <Input name="area_ha" type="number" step="0.01" min="0" label="Platība, ha" defaultValue={v(c?.area_ha)} optional />
          <Input name="total_value" type="number" step="0.01" min="0" label="Līguma summa" defaultValue={v(c?.total_value)} optional hint="Ja tukšs — aprēķina no cenas" />
        </FormGrid>
        <FormGrid cols={3}>
          <Input name="payment_terms_days" type="number" min="0" max="365" label="Apmaksa, dienas" defaultValue={v(c?.payment_terms_days)} optional />
          <Input name="guarantee" label="Nodrošinājums / garantija" defaultValue={c?.guarantee ?? ""} maxLength={500} optional />
          <Input name="external_ref" label="Iepirkuma ID / atsauce" defaultValue={c?.external_ref ?? ""} maxLength={200} optional />
        </FormGrid>
      </Section>

      <Section title="Noteikumi un piezīmes">
        <Textarea name="penalties" label="Līgumsodi, būtiskie noteikumi" defaultValue={c?.penalties ?? ""} rows={2} maxLength={2000} optional />
        <Textarea name="notes" label="Piezīmes" defaultValue={c?.notes ?? ""} rows={3} maxLength={5000} optional />
      </Section>
    </div>
  );
}

export function NewContractDialog({ o, label = "Jauns līgums" }: { o: ContractOptions; label?: string }) {
  return (
    <FormDialog size="xl" title="Jauns līgums" description="Parakstīts vai vēl sarunās esošs darba līgums." action={createContract as FormAction}
      trigger={<Button><Plus className="h-4 w-4" /> {label}</Button>} submitLabel="Izveidot">
      <ContractFields o={o} />
    </FormDialog>
  );
}

export function EditContractDialog({ c, o }: { c: ContractFormRow; o: ContractOptions }) {
  return (
    <FormDialog size="xl" title={c.title} description="Rediģēt līgumu" action={updateContract.bind(null, c.id) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> Rediģēt</Button>}>
      <ContractFields c={c} o={o} />
    </FormDialog>
  );
}

export function AddMilestoneDialog({ contractId }: { contractId: string }) {
  return (
    <FormDialog title="Jauns termiņš vai maksājums" action={addMilestone.bind(null, contractId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><FilePlus2 className="h-4 w-4" /> Pievienot</Button>}>
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Select name="kind" label="Veids" defaultValue="deadline" options={opts(MILESTONE_KIND_LABEL)} />
          <Input name="due_date" type="date" label="Datums" optional />
        </FormGrid>
        <Input name="title" label="Apraksts" required maxLength={200} placeholder="piem. 1. posma nodošana, rēķins par septembri" />
        <Input name="amount" type="number" step="0.01" min="0" label="Summa" optional />
        <Textarea name="notes" label="Piezīmes" rows={2} maxLength={2000} optional />
      </div>
    </FormDialog>
  );
}

export function MilestoneActions({ id, contractId, done }: { id: string; contractId: string; done: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <ActionButton action={toggleMilestone.bind(null, id, contractId, !done) as FormAction} variant="ghost" size="sm" className={done ? "text-muted" : "text-ok"}>
        {done ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}<span className="hidden sm:inline">{done ? "Atjaunot" : "Izpildīts"}</span>
      </ActionButton>
      <ActionButton action={removeMilestone.bind(null, id, contractId) as FormAction} variant="ghost" size="sm" className="text-muted hover:text-crit" confirm="Dzēst šo ierakstu?">
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </span>
  );
}
