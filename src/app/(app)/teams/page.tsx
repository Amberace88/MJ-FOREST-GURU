import type { Metadata } from "next";
import { Crown, HardHat, Users } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/ui/filter-bar";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { getOptions } from "@/lib/queries";
import { likeTerm, sp as one } from "@/lib/utils";
import { NewTeamDialog } from "./components";

export const metadata: Metadata = { title: "Komandas" };
const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

export default async function TeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("view_all_employees", "view_team", "manage_teams");
  const sp = await searchParams;
  const q = one(sp.q);
  const countryParam = one(sp.country) ?? ctx.countryId ?? undefined;
  const country = isUuid(countryParam) ? countryParam : undefined;
  const canManage = ctx.can("manage_teams");
  const opts = await getOptions(ctx);

  let query = ctx.supabase.from("teams")
    .select("id, name, country_id, manager:employees!teams_manager_employee_id_fkey(id, full_name), foreman:employees!teams_foreman_employee_id_fkey(id, full_name)")
    .eq("organization_id", ctx.org.id).is("archived_at", null).order("name");
  const term = likeTerm(q);
  if (term) query = query.ilike("name", term);
  if (country) query = query.or(`country_id.eq.${country},country_id.is.null`);
  const { data } = await query;
  const teams = data ?? [];

  // Member counts from employees visible to the user (RLS-scoped).
  const members = new Map<string, { names: string[]; count: number }>();
  if (teams.length) {
    const { data: emps } = await ctx.supabase.from("employees").select("team_id, full_name")
      .eq("organization_id", ctx.org.id).in("team_id", teams.map((t) => t.id)).is("deleted_at", null).is("archived_at", null).order("first_name");
    for (const e of emps ?? []) {
      if (!e.team_id) continue;
      const m = members.get(e.team_id) ?? { names: [], count: 0 };
      m.count += 1;
      if (m.names.length < 5) m.names.push(e.full_name ?? "");
      members.set(e.team_id, m);
    }
  }

  return (
    <>
      <PageHeader title={ctx.t("teams.title")} subtitle={ctx.t("teams.subtitle")}
        actions={canManage && <NewTeamDialog countries={opts.countryOptions} employees={opts.employeeOptions} defaultOpen={one(sp.new) === "1"} />} />
      <FilterBar filters={[
        { type: "search", name: "q" },
        ...(ctx.countryId ? [] : [{ type: "select" as const, name: "country", label: ctx.t("common.country"), options: opts.countryOptions }]),
      ]} />
      {teams.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={ctx.t("teams.empty")}
          action={canManage ? <NewTeamDialog countries={opts.countryOptions} employees={opts.employeeOptions} /> : undefined} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t, i) => {
            const c = ctx.countries.find((x) => x.id === t.country_id);
            const m = members.get(t.id) ?? { names: [], count: 0 };
            const manager = t.manager as { id: string; full_name: string } | null;
            const foreman = t.foreman as { id: string; full_name: string } | null;
            return (
              <li key={t.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                <Link href={`/teams/${t.id}`} className="card card-hover topo-bg block h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c && <span className="text-lg" aria-hidden>{c.flag}</span>}
                        <span className="truncate font-display text-2xl font-bold uppercase tracking-wide">{t.name}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">{ctx.t("teams.membersCount", { n: m.count })}</p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-moss"><Users className="h-5 w-5" /></span>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-muted">
                    <div className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-amber" />{ctx.t("teams.manager")}: <span className="truncate text-ink-2">{manager?.full_name ?? "—"}</span></div>
                    <div className="flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5 text-moss" />{ctx.t("teams.foreman")}: <span className="truncate text-ink-2">{foreman?.full_name ?? "—"}</span></div>
                  </div>
                  {m.count > 0 && (
                    <div className="mt-4 flex items-center -space-x-2">
                      {m.names.map((n, k) => <Avatar key={k} name={n} size={30} className="ring-2 ring-surface" />)}
                      {m.count > m.names.length && <span className="grid h-[30px] min-w-[30px] place-items-center rounded-full bg-surface-3 px-1.5 text-[11px] text-ink-2 ring-2 ring-surface">+{m.count - m.names.length}</span>}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
