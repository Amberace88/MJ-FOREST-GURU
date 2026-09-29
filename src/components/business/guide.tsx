import { Briefcase, ExternalLink, Gavel, Landmark, Lightbulb, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OPPORTUNITIES, type Opportunity } from "@/lib/forest/opportunities";

const KIND_ICON: Record<Opportunity["kind"], typeof Gavel> = { tender: Gavel, buyer: Briefcase, registry: Landmark, association: Users, tip: Lightbulb };
const KIND_LABEL: Record<Opportunity["kind"], string> = { tender: "Iepirkumi", buyer: "Pasūtītāji / pircēji", registry: "Reģistri un dati", association: "Asociācijas", tip: "Padoms" };

/** Where to find work, clients and contracts in LV / SE / IS (researched directory). */
export function OpportunityGuide({ countries = ["LV", "SE", "IS"] }: { countries?: ("LV" | "SE" | "IS")[] }) {
  return (
<div className="grid gap-5 xl:grid-cols-3">
          {countries.map((code, ci) => {
            const g = OPPORTUNITIES[code];
            const flag = { LV: "🇱🇻", SE: "🇸🇪", IS: "🇮🇸" }[code];
            return (
              <div key={code} className="animate-fade-up" style={{ animationDelay: `${ci * 70}ms` }}><Card>
                <CardHeader title={`${flag} ${g.headline}`} />
                <CardBody className="space-y-4">
                  <p className="text-sm leading-relaxed text-ink-2">{g.market}</p>
                  <ul className="space-y-2.5">
                    {g.items.map((it, i) => {
                      const Icon = KIND_ICON[it.kind];
                      return (
                        <li key={i} className="rounded-xl border border-line bg-surface-2/40 p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-forest-800/70 text-forest-300"><Icon className="h-3.5 w-3.5" /></span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{KIND_LABEL[it.kind]}</p>
                              <p className="text-sm font-medium text-ink">{it.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-ink-2">{it.text}</p>
                              {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber hover:underline">{new URL(it.url).hostname.replace(/^www\./, "")} <ExternalLink className="h-3 w-3" /></a>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card></div>
            );
          })}
          <p className="text-xs text-faint xl:col-span-3">Informācija apkopota 2026. gada septembrī no publiskiem avotiem; cenas un termiņi orientējoši — pirms piedāvājuma pārbaudiet aktuālos datus.</p>
        </div>
  );
}
