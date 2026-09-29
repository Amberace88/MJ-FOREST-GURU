"use client";

import { useRef, useState } from "react";
import { ForestMap } from "@/components/map";
import type { ForestLead, ForestProject, PickedPoint } from "@/components/map/forest-map";
import { NewLeadDialog, type Opt } from "./lead-components";

/** Map tab: the forest map + "add opportunity here" flow. */
export function ForestWorkspace({ countries, leads, projects, countryOptions, companyOptions, countryCodes, countryIdByCode, canEdit, focusLead, focusPoint }: {
  countries: string[]; leads: ForestLead[]; projects: ForestProject[]; countryOptions: Opt[]; companyOptions: Opt[];
  countryCodes: Record<string, string>; countryIdByCode: Record<string, string>; canEdit: boolean; focusLead: string | null; focusPoint?: { lat: number; lng: number } | null;
}) {
  const openRef = useRef<(() => void) | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number; countryId?: string | null } | null>(null);
  return (
    <>
      <ForestMap countries={countries} leads={leads} projects={projects} focusLead={focusLead} focusPoint={focusPoint}
        onAddLead={canEdit ? (p: PickedPoint) => { setPoint({ lat: p.lat, lng: p.lng, countryId: p.country ? countryIdByCode[p.country] ?? null : null }); requestAnimationFrame(() => openRef.current?.()); } : undefined} />
      {canEdit && <NewLeadDialog countries={countryOptions} companies={companyOptions} countryCodes={countryCodes} openRef={openRef} point={point} trigger={false} />}
    </>
  );
}
