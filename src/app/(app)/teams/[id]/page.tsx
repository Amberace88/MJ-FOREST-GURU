import type { Metadata } from "next";
import { Archive, Crown, HardHat, TreePine, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { requirePermission } from "@/lib/context";
import { fmtHours } from "@/lib/format";
import { getOptions } from "@/lib/queries";
import { statusTone } from "@/lib/utils";
import { liveInfo, photoUrls } from "../../employees/data";
import { archiveTeam, removeTeamMember } from "../actions";
import { AddMembersDialog, EditTeamDialog, type Candidate } from "../components";

export const metadata: Metadata = { title: "Komanda" };

export default async function TeamDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("view_all_employees", "view_team", "manage_teams");
  const { id } = await params;
  const { data: team } = await ctx.supabase.from("teams")
    .select("id, name, country_id, archived_at, manager_employee_id, foreman_employee_id, manager:employees!teams_manager_employee_id_fkey(id, full_name), foreman:employees!teams_foreman_employee_id_fkey(id, full_name)")
    .eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!team) notFound();

  const canManage = ctx.can("manage_teams");
  const canMembers = ctx.can("edit_employees") && !team.archived_at;
  const country = ctx.countries.find((c) => c.id === team.country_id);
  const manager = team.manager as { id: string; full_name: string } | null;
  const foreman = team.foreman as { id: string; full_name: string } | null;

  const [membersRes, projectsRes, opts] = await Promise.all([
    ctx.supabase.from("employees").select("id, full_name, job_title, status, photo_path")
      .eq("organization_id", ctx.org.id).eq("team_id", id).is("deleted_at", null).is("archived_at", null).order("first_name"),
    ctx.supabase.from("project_teams").select("project:projects(id, code, name, status)").eq("team_id", id),
    getOptions(ctx),
  ]);
  const members = membersRes.data ?? [];
  const [live, photos] = await Promise.all([liveInfo(ctx, members.map((m) => m.id)), photoUrls(ctx, members.map((m) => m.photo_path))]);
  const working = members.filter((m) => live.get(m.id)?.working).length;
  const todayTotal = members.reduce((a, m) => a + (live.get(m.id)?.todayHours ?? 0), 0);
  const projects = (projectsRes.data ?? []).map((p) => p.project as { id: string; code: string; name: string; status: string } | null).filter((p): p is { id: string; code: string; name: string; status: string } => Boolean(p));

  const teamNames = new Map(opts.teams.map((t) => [t.id, t.name]));
  const memberIds = new Set(members.map((m) => m.id));
  const candidates: Candidate[] = opts.employees.filter((e) => !memberIds.has(e.id)).map((e) => ({
    id: e.id, name: e.full_name ?? "", jobTitle: e.job_title, teamName: e.team_id ? teamNames.get(e.team_id) ?? null : null,
  }));

  return (
    <>
      <PageHeader
        back={{ href: "/teams", label: ctx.t("teams.title") }}
        eyebrow={country ? <span>{country.flag} {country.name}</span> : undefined}
        title={team.name}
        subtitle={ctx.t("teams.membersCount", { n: members.length })}
        actions={<>
          {canManage && <EditTeamDialog countries={opts.countryOptions} employees={opts.employeeOptions} values={{ ...team, id }} />}
          {canManage && !team.archived_at && (
            <ActionButton action={archiveTeam.bind(null, id)} variant="ghost" confirm={ctx.t("teams.archiveConfirm")}><Archive className="h-4 w-4" /> {ctx.t("common.archive")}</ActionButton>
          )}
        </>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={ctx.t("teams.manager")} value={manager ? <Link href={`/employees/${manager.id}`} className="hover:text-amber">{manager.full_name}</Link> : "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("teams.foreman")} value={foreman ? <Link href={`/employees/${foreman.id}`} className="hover:text-amber">{foreman.full_name}</Link> : "—"} /></Card>
        <Card className="p-4"><Stat label={ctx.t("teams.workingNow")} value={`${working} / ${members.length}`} /></Card>
        <Card className="p-4"><Stat label={ctx.t("employees.todayHours")} value={fmtHours(todayTotal)} /></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={ctx.t("teams.members")} icon={<Users className="h-4 w-4" />} action={canMembers && <AddMembersDialog teamId={id} candidates={candidates} />} />
          <CardBody>
            {members.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => {
                  const info = live.get(m.id);
                  const role = m.id === team.manager_employee_id ? "manager" : m.id === team.foreman_employee_id ? "foreman" : null;
                  return (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                      <span className="relative">
                        <Avatar name={m.full_name} src={m.photo_path ? photos.get(m.photo_path) : null} size={36} />
                        {info?.working && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-ok" />}
                      </span>
                      <Link href={`/employees/${m.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium hover:text-amber">
                          {m.full_name}
                          {role === "manager" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber" aria-label={ctx.t("teams.manager")} />}
                          {role === "foreman" && <HardHat className="h-3.5 w-3.5 shrink-0 text-moss" aria-label={ctx.t("teams.foreman")} />}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {m.job_title ?? "—"}{info?.project ? ` · ${info.project.code}` : ""}{info && info.todayHours > 0 ? ` · ${fmtHours(info.todayHours)}` : ""}
                        </span>
                      </Link>
                      <Badge tone={statusTone(m.status)} className="hidden sm:inline-flex">{ctx.label("employees.status", m.status)}</Badge>
                      {canMembers && (
                        <ActionButton action={removeTeamMember.bind(null, id, m.id)} variant="ghost" size="xs" confirm={ctx.t("teams.removeConfirm")}>{ctx.t("common.unassign")}</ActionButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title={ctx.t("teams.noMembers")} action={canMembers ? <AddMembersDialog teamId={id} candidates={candidates} /> : undefined} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={ctx.t("teams.projects")} icon={<TreePine className="h-4 w-4" />} />
          <CardBody>
            {projects.length ? (
              <ul className="divide-y divide-line/70">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-amber">
                      <span className="font-display text-base font-semibold tracking-wide">{p.code}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
                      <Badge tone={statusTone(p.status)}>{ctx.label("projects.status", p.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">{ctx.t("common.noData")}</p>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
