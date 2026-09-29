import type { Metadata } from "next";
import { Archive, ArrowRight, CalendarCheck2, ExternalLink, FileText, Gauge, Mail, Phone, TreePine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "@/components/shared/activity";
import { FileGallery, loadFiles } from "@/components/shared/file-gallery";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DefinitionList, Stat } from "@/components/ui/card";
import { ActionButton, type FormAction } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import {
  CONTRACT_SOURCE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, contractValue, daysBetween, MILESTONE_KIND_LABEL, PRICING_LABEL,
  timeProgress, WORK_TYPE_LABEL, type ContractStatus, type PricingModel, type WorkType,
} from "@/lib/contracts";
import { fmtDate, fmtMoney, fmtNumber, todayIn } from "@/lib/format";
import { cn } from "@/lib/utils";
import { archiveContract, projectFromContract, setContractStatus } from "../actions";
import { AddMilestoneDialog, EditContractDialog, MilestoneActions, type ContractFormRow } from "../components";
import { loadContractOptions } from "../options";

export const metadata: Metadata = { title: "Līgums" };

/** Next sensible status step(s) from the current one. */
const NEXT: Record<ContractStatus, ContractStatus[]> = {
  draft: ["negotiation", "signed"], negotiation: ["signed"], signed: ["active"], active: ["completed", "terminated"],
  completed: ["active"], terminated: [], expired: ["active"],
};
const NEXT_LABEL: Partial<Record<ContractStatus, string>> = {
  negotiation: "Sākt sarunas", signed: "Atzīmēt kā parakstītu", active: "Sākt izpildi", completed: "Pabeigt", terminated: "Lauzt",
};

export default async function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("manage_projects", "view_finance");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: c } = await ctx.supabase.from("contracts")
    .select("*, contact:business_contacts(id, company_name, contact_name, phone, email, website), project:projects(id, code, name, status), lead:forest_leads(id, title)")
    .eq("id", id).eq("organization_id", ctx.org.id).is("deleted_at", null).maybeSingle();
  if (!c) notFound();
  const canEdit = ctx.can("manage_projects");
  const today = todayIn(ctx.timezone);
  const status = c.status as ContractStatus;
  const contact = c.contact as { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null; website: string | null } | null;
  const project = c.project as { id: string; code: string; name: string; status: string } | null;
  const lead = c.lead as { id: string; title: string } | null;

  const [milestonesRes, files, prodRes, options] = await Promise.all([
    ctx.supabase.from("contract_milestones").select("id, kind, title, due_date, amount, done_at, notes").eq("contract_id", id).is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    loadFiles(ctx, "contract", id),
    c.project_id ? ctx.supabase.from("production_logs").select("quantity, production_date").eq("project_id", c.project_id).eq("unit", "m3").is("deleted_at", null).limit(20000)
      : Promise.resolve({ data: [] as { quantity: number; production_date: string }[] }),
    canEdit ? loadContractOptions(ctx) : Promise.resolve(null),
  ]);
  if (options && project && !options.projects.some((p) => p.value === project.id)) options.projects.unshift({ value: project.id, label: `${project.code} · ${project.name}` });
  const milestones = milestonesRes.data ?? [];
  const produced = (prodRes.data ?? []).reduce((a, p) => a + Number(p.quantity), 0);
  const { value, estimated } = contractValue(c);
  const tp = timeProgress(c.start_date, c.end_date, today);
  const vp = c.volume_m3 && c.project_id ? Math.round((produced / Number(c.volume_m3)) * 100) : null;
  const earned = c.unit_price != null && c.pricing_model === "per_m3" && c.project_id ? produced * Number(c.unit_price) : null;
  const invoiced = milestones.filter((m) => m.kind === "invoice" && m.done_at).reduce((a, m) => a + Number(m.amount ?? 0), 0);
  const paid = milestones.filter((m) => m.kind === "payment" && m.done_at).reduce((a, m) => a + Number(m.amount ?? 0), 0);
  const daysLeft = c.end_date ? daysBetween(today, c.end_date) : null;
  const noticeLeft = c.notice_date ? daysBetween(today, c.notice_date) : null;
  const country = ctx.countries.find((x) => x.id === c.country_id);
  const formRow = c as unknown as ContractFormRow;
  const cur = c.currency;

  return (
    <>
      <PageHeader back={{ href: "/contracts", label: "Līgumi" }}
        eyebrow={<>
          <Badge tone={CONTRACT_STATUS_TONE[status]} dot>{CONTRACT_STATUS_LABEL[status]}</Badge>
          <span>{WORK_TYPE_LABEL[c.work_type as WorkType] ?? c.work_type}</span>
          {country && <span>{country.flag} {country.name}</span>}
          {c.number && <span>Nr. {c.number}</span>}
        </>}
        title={c.title}
        subtitle={contact?.company_name ?? c.client_name ?? undefined}
        actions={canEdit && options ? (
          <div className="flex flex-wrap gap-2">
            {NEXT[status].map((s) => (
              <ActionButton key={s} action={setContractStatus.bind(null, id, s) as FormAction} variant={s === "terminated" ? "ghost" : "primary"} size="md"
                confirm={s === "terminated" ? "Atzīmēt līgumu kā lauztu?" : undefined} className={s === "terminated" ? "text-crit" : undefined}>
                {NEXT_LABEL[s] ?? CONTRACT_STATUS_LABEL[s]}
              </ActionButton>
            ))}
            <EditContractDialog c={formRow} o={options} />
          </div>
        ) : undefined} />

      {noticeLeft != null && noticeLeft >= 0 && noticeLeft <= 30 && (status === "active" || status === "signed") && (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Līdz {fmtDate(c.notice_date)} jāizlemj par pagarināšanu vai uzteikšanu ({noticeLeft === 0 ? "šodien" : `pēc ${noticeLeft} d.`}).
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-5">
        <Stat label="Līguma vērtība" value={value != null ? fmtMoney(value, cur) : "—"} hint={estimated ? "aprēķināta no cenas × apjoma" : c.unit_price != null ? `${fmtMoney(c.unit_price, cur)} ${PRICING_LABEL[c.pricing_model as PricingModel] ?? ""}` : undefined} />
        <Stat label="Periods" value={c.start_date || c.end_date ? `${fmtDate(c.start_date)} – ${fmtDate(c.end_date)}` : "—"}
          hint={daysLeft == null ? undefined : daysLeft < 0 ? `beidzās pirms ${-daysLeft} d.` : `${daysLeft} d. atlikušas`} />
        <Stat label="Izpilde" value={vp != null ? `${vp}%` : "—"} hint={c.project_id ? `${fmtNumber(produced)} no ${fmtNumber(c.volume_m3)} m³` : "piesaisti darba objektu"} />
        <Stat label="Izrakstīts" value={invoiced ? fmtMoney(invoiced, cur) : "—"} hint={earned != null ? `nopelnīts ~${fmtMoney(earned, cur)}` : undefined} />
        <Stat label="Saņemts" value={paid ? fmtMoney(paid, cur) : "—"} hint={invoiced > paid ? `gaida ${fmtMoney(invoiced - paid, cur)}` : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {(tp != null || vp != null) && (
            <Card>
              <CardHeader title="Progress" icon={<Gauge className="h-4 w-4" />} />
              <CardBody className="space-y-4">
                {tp != null && <Progress label="Laiks" value={tp} right={`${tp}%`} tone={daysLeft != null && daysLeft < 0 && (status === "active" || status === "signed") ? "crit" : "forest"} />}
                {vp != null && <Progress label="Apjoms (no ražošanas uzskaites)" value={vp} right={`${fmtNumber(produced)} / ${fmtNumber(c.volume_m3)} m³`} tone={tp != null && vp + 15 < tp ? "amber" : "forest"} />}
                {tp != null && vp != null && vp + 15 < tp && <p className="text-xs text-warn">Izpilde atpaliek no grafika — pārbaudi tehniku un brigādes.</p>}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Termiņi, rēķini un maksājumi" icon={<CalendarCheck2 className="h-4 w-4" />} action={canEdit ? <AddMilestoneDialog contractId={id} /> : undefined} />
            <CardBody>
              {milestones.length === 0 ? <p className="text-sm text-muted">Pievieno nodošanas termiņus, rēķinus un gaidāmos maksājumus — tie parādīsies arī līgumu sarakstā pie tuvākajiem termiņiem.</p> : (
                <ul className="divide-y divide-line">
                  {milestones.map((m) => {
                    const left = m.due_date ? daysBetween(today, m.due_date) : null;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-medium", m.done_at ? "text-muted line-through" : "text-ink")}>{m.title}</p>
                          <p className="text-xs text-muted">
                            <Badge tone="neutral" className="mr-1.5">{MILESTONE_KIND_LABEL[m.kind as keyof typeof MILESTONE_KIND_LABEL] ?? m.kind}</Badge>
                            {m.due_date ? fmtDate(m.due_date) : "bez datuma"}
                            {m.amount != null && ` · ${fmtMoney(m.amount, cur)}`}
                            {!m.done_at && left != null && <span className={cn("ml-1.5", left < 0 ? "text-crit" : left <= 7 ? "text-warn" : "")}>{left < 0 ? `nokavēts ${-left} d.` : left === 0 ? "šodien" : `pēc ${left} d.`}</span>}
                            {m.done_at && <span className="ml-1.5 text-ok">izpildīts {fmtDate(m.done_at)}</span>}
                          </p>
                        </div>
                        {canEdit && <MilestoneActions id={m.id} contractId={id} done={Boolean(m.done_at)} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dokumenti" subtitle="Līgums, pielikumi, akti, pavadzīmes (PDF, Word, Excel, foto)" icon={<FileText className="h-4 w-4" />}
              action={canEdit ? <div className="w-44"><FileUploader orgId={ctx.org.id} entityType="contract" entityId={id} bucket="documents" kind="document" compact
                accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*" label="Pievienot failu" /></div> : undefined} />
            <CardBody><FileGallery files={files} tz={ctx.timezone} empty="Vēl nav pievienotu dokumentu." /></CardBody>
          </Card>

          <Card>
            <CardHeader title="Vēsture" />
            <CardBody><Activity ctx={ctx} entity="contracts" entityId={id} /></CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Līguma dati" />
            <CardBody>
              <DefinitionList className="sm:grid-cols-1" items={[
                { label: "Avots", value: CONTRACT_SOURCE_LABEL[c.source as keyof typeof CONTRACT_SOURCE_LABEL] ?? c.source },
                { label: "Parakstīts", value: c.signed_at ? fmtDate(c.signed_at) : "—" },
                { label: "Pagarināt / uzteikt līdz", value: c.notice_date ? fmtDate(c.notice_date) : "—" },
                { label: "Cena", value: c.unit_price != null ? `${fmtMoney(c.unit_price, cur)} ${PRICING_LABEL[c.pricing_model as PricingModel] ?? ""}` : PRICING_LABEL[c.pricing_model as PricingModel] },
                { label: "Apjoms", value: [c.volume_m3 ? `${fmtNumber(c.volume_m3)} m³` : null, c.area_ha ? `${fmtNumber(c.area_ha, 2)} ha` : null].filter(Boolean).join(" · ") || "—" },
                { label: "Apmaksas termiņš", value: c.payment_terms_days != null ? `${c.payment_terms_days} dienas` : "—" },
                { label: "Nodrošinājums", value: c.guarantee ?? "—" },
                { label: "Vieta", value: c.location ?? "—" },
                { label: "Atsauce", value: c.external_ref ?? "—" },
              ]} />
              {c.penalties && <div className="mt-4"><p className="text-xs uppercase tracking-wider text-muted">Līgumsodi, noteikumi</p><p className="mt-1 whitespace-pre-line text-sm text-ink-2">{c.penalties}</p></div>}
              {c.notes && <div className="mt-4"><p className="text-xs uppercase tracking-wider text-muted">Piezīmes</p><p className="mt-1 whitespace-pre-line text-sm text-ink-2">{c.notes}</p></div>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Saistītais" />
            <CardBody className="space-y-3 text-sm">
              {contact ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Pasūtītājs</p>
                  <Link href="/business?tab=contacts" className="font-medium text-ink hover:text-amber">{contact.company_name}</Link>
                  {contact.contact_name && <p className="text-xs text-muted">{contact.contact_name}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                    {contact.phone && <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Phone className="h-3 w-3" />{contact.phone}</a>}
                    {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-ink-2 hover:text-amber"><Mail className="h-3 w-3" />{contact.email}</a>}
                  </div>
                </div>
              ) : c.client_name ? <div><p className="text-xs uppercase tracking-wider text-muted">Pasūtītājs</p><p className="text-ink">{c.client_name}</p></div> : null}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Darba objekts</p>
                {project ? (
                  <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-amber"><TreePine className="h-4 w-4 text-moss" /> {project.code} · {project.name}</Link>
                ) : canEdit ? (
                  <div className="mt-1"><ActionButton action={projectFromContract.bind(null, id) as FormAction} variant="secondary" size="sm" confirm="Izveidot darba objektu no šī līguma?">
                    <ArrowRight className="h-4 w-4" /> Izveidot darba objektu
                  </ActionButton></div>
                ) : <p className="text-muted">—</p>}
              </div>
              {lead && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">No iespējas</p>
                  <Link href="/business?tab=pipeline" className="text-ink hover:text-amber">{lead.title}</Link>
                </div>
              )}
              {c.external_ref?.startsWith("iub:") && (
                <a href={`https://www.eis.gov.lv/EKEIS/Supplier/Procurement/${c.external_ref.split(":")[1]}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-amber hover:underline">
                  <ExternalLink className="h-3 w-3" /> Iepirkums EIS
                </a>
              )}
            </CardBody>
          </Card>

          {canEdit && (
            <ActionButton action={archiveContract.bind(null, id) as FormAction} variant="ghost" size="sm" className="text-muted hover:text-crit" confirm="Arhivēt šo līgumu? Tas pazudīs no saraksta (vēsture saglabājas).">
              <Archive className="h-4 w-4" /> Arhivēt līgumu
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}

function Progress({ label, value, right, tone }: { label: string; value: number; right: string; tone: "forest" | "amber" | "crit" }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{label}</span><span className="tabular text-ink-2">{right}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-all", tone === "crit" ? "bg-crit" : tone === "amber" ? "bg-amber" : "bg-moss")} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
