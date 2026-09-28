"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Select } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import type { CompanyLite } from "@/lib/companies";

type CompaniesState = {
  /** all non-deleted companies (inactive included — for badges and existing values) */
  all: CompanyLite[];
  /** active companies — offered for new values */
  active: CompanyLite[];
  /** global company filter (topbar), null = all */
  companyId: string | null;
};

const CompaniesContext = createContext<CompaniesState>({ all: [], active: [], companyId: null });

/** Provided once by the AppShell so every client form can offer the company select. */
export function CompaniesProvider({ companies, companyId, children }: { companies: CompanyLite[]; companyId: string | null; children: ReactNode }) {
  const value = useMemo<CompaniesState>(
    () => ({ all: companies, active: companies.filter((c) => c.is_active), companyId }),
    [companies, companyId],
  );
  return <CompaniesContext.Provider value={value}>{children}</CompaniesContext.Provider>;
}

export function useCompanies() {
  return useContext(CompaniesContext);
}

/**
 * Company select for business records (projects, employees, machines, expenses).
 * Renders nothing when the organization has no companies — server actions then leave
 * `company_id` untouched (they check `fd.has("company_id")`).
 * Default for new records: the global filter, else the only active company.
 */
export function CompanySelect({ value, name = "company_id", className, hint }: { value?: string | null; name?: string; className?: string; hint?: ReactNode }) {
  const { t } = useT();
  const { all, active, companyId } = useCompanies();
  if (all.length === 0) return null;
  const current = value === undefined ? (companyId ?? (active.length === 1 ? active[0].id : "")) : (value ?? "");
  const options = all
    .filter((c) => c.is_active || c.id === current)
    .map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (${t("companies.inactive").toLowerCase()})` }));
  return (
    <Select name={name} label={t("companies.company")} defaultValue={current} options={options} placeholder={t("companies.none")}
      optional className={className} hint={hint} />
  );
}
