"use client";

import { Pencil, Plus, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog, FormGrid, Input, Select, type FormAction, type Option } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { useT } from "@/i18n/client";
import { addTeamMember, createTeam, updateTeam } from "./actions";

export type TeamValues = { id?: string; name?: string; country_id?: string | null; manager_employee_id?: string | null; foreman_employee_id?: string | null };

function TeamFields({ countries, employees, values }: { countries: Option[]; employees: Option[]; values?: TeamValues }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <FormGrid>
        <Input name="name" label={t("teams.name")} defaultValue={values?.name} required maxLength={100} />
        <Select name="country_id" label={t("common.country")} defaultValue={values?.country_id ?? ""} options={countries} placeholder={t("common.allCountries")} />
      </FormGrid>
      <FormGrid>
        <Select name="manager_employee_id" label={t("teams.manager")} defaultValue={values?.manager_employee_id ?? ""} options={employees} placeholder="" />
        <Select name="foreman_employee_id" label={t("teams.foreman")} defaultValue={values?.foreman_employee_id ?? ""} options={employees} placeholder="" />
      </FormGrid>
    </div>
  );
}

export function NewTeamDialog({ countries, employees, defaultOpen }: { countries: Option[]; employees: Option[]; defaultOpen?: boolean }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("teams.new")} action={createTeam as FormAction} defaultOpen={defaultOpen}
      trigger={<Button><Plus className="h-4 w-4" /> {t("teams.new")}</Button>}>
      <TeamFields countries={countries} employees={employees} />
    </FormDialog>
  );
}

export function EditTeamDialog({ countries, employees, values }: { countries: Option[]; employees: Option[]; values: TeamValues & { id: string } }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("teams.edit")} action={updateTeam.bind(null, values.id) as FormAction}
      trigger={<Button variant="secondary"><Pencil className="h-4 w-4" /> {t("common.edit")}</Button>}>
      <TeamFields countries={countries} employees={employees} values={values} />
    </FormDialog>
  );
}

export type Candidate = { id: string; name: string; jobTitle: string | null; teamName: string | null };

/** Multi-select dialog: checked employees get employees.team_id = this team. */
export function AddMembersDialog({ teamId, candidates }: { teamId: string; candidates: Candidate[] }) {
  const { t } = useT();
  return (
    <FormDialog size="md" title={t("teams.addMember")} description={t("teams.moveHint")} action={addTeamMember.bind(null, teamId) as FormAction}
      trigger={<Button size="sm" variant="secondary"><UserPlus className="h-4 w-4" /> {t("teams.addMember")}</Button>}>
      <CandidatePicker candidates={candidates} />
    </FormDialog>
  );
}

function CandidatePicker({ candidates }: { candidates: Candidate[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? candidates.filter((c) => `${c.name} ${c.jobTitle ?? ""} ${c.teamName ?? ""}`.toLowerCase().includes(s)) : candidates;
  }, [q, candidates]);
  if (!candidates.length) return <p className="text-sm text-muted">{t("common.noData")}</p>;
  return (
    <div className="space-y-3">
      {[...checked].map((id) => <input key={id} type="hidden" name="employee_ids[]" value={id} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.searchPlaceholder")} aria-label={t("common.search")} className="field pl-9" />
      </div>
      <ul className="max-h-[45vh] divide-y divide-line/70 overflow-y-auto rounded-xl border border-line">
        {list.map((c) => {
          const on = checked.has(c.id);
          return (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2/60">
                <input type="checkbox" checked={on} className="h-4 w-4 accent-[var(--forest-500)]"
                  onChange={() => setChecked((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                <Avatar name={c.name} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.jobTitle ?? "—"}{c.teamName ? ` · ${c.teamName}` : ""}</span>
                </span>
              </label>
            </li>
          );
        })}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-muted">{t("search.noResults")}</li>}
      </ul>
      <p className="text-xs text-muted tabular">{checked.size} / {candidates.length}</p>
    </div>
  );
}
