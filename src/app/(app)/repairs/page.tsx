import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { RepairTable, type RepairRow } from "@/components/shared/lists";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { requireOrg } from "@/lib/context";
import { getOptions } from "@/lib/queries";
import { likeTerm, searchParamsToString, sp as one } from "@/lib/utils";
import { ReportProblemDialog } from "./components";
import { OPEN_REPAIR_STATUSES, REPAIR_PRIORITIES, REPAIR_STATUSES } from "./workflow";

export const metadata: Metadata = { title: "Remonti" };
const PAGE = 30;
const isUuid = (v: string | undefined): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function RepairsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const q = one(sp.q);
  const status = one(sp.status);
  const priority = one(sp.priority);
  const machine = one(sp.machine);

  let query = ctx.supabase.from("repair_requests")
    .select("id, title, priority, status, created_at, category, machine:machines(id, name), project:projects(code), mechanic:employees!repair_requests_assigned_mechanic_id_fkey(full_name)", { count: "exact" })
    .eq("organization_id", ctx.org.id).is("deleted_at", null)
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const term = likeTerm(q);
  if (term) query = query.or(`title.ilike.${term},description.ilike.${term}`);
  if (status === "open") query = query.in("status", [...OPEN_REPAIR_STATUSES]);
  else if (status && (REPAIR_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (priority && (REPAIR_PRIORITIES as readonly string[]).includes(priority)) query = query.eq("priority", priority);
  if (isUuid(machine)) query = query.eq("machine_id", machine);

  const [{ data, count }, opts] = await Promise.all([query, getOptions(ctx)]);
  const machineProjects = Object.fromEntries(opts.machines.map((x) => [x.id, x.current_project_id]));

  return (
    <>
      <PageHeader title={ctx.t("repairs.title")} subtitle={ctx.t("repairs.subtitle")} back={{ href: "/maintenance", label: ctx.t("maintenance.title") }}
        actions={<ReportProblemDialog orgId={ctx.org.id} machines={opts.machineOptions} projects={opts.projectOptions} categories={opts.problemCategories}
          machineProjects={machineProjects} defaultMachineId={isUuid(machine) ? machine : null} defaultOpen={one(sp.new) === "1"} />} />
      <FilterBar filters={[
        { type: "search", name: "q" },
        { type: "select", name: "status", label: ctx.t("common.status"), options: [{ value: "open", label: ctx.t("repairs.openOnly") }, ...REPAIR_STATUSES.map((s) => ({ value: s, label: ctx.label("repairs.status", s) }))] },
        { type: "select", name: "priority", label: ctx.t("common.priority"), options: REPAIR_PRIORITIES.map((p) => ({ value: p, label: ctx.label("repairs.priority", p) })) },
        { type: "select", name: "machine", label: ctx.t("common.machine"), options: opts.machineOptions },
      ]} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title={ctx.t("repairs.empty")} />
      ) : (
        <RepairTable rows={(data ?? []) as RepairRow[]} tr={ctx} tz={ctx.timezone} />
      )}
      <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/repairs${searchParamsToString(sp, { page: String(p) })}`} />
    </>
  );
}
