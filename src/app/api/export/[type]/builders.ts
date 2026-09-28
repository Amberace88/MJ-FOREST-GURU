import "server-only";
import { fetchAll } from "@/app/(app)/analytics/fetch-all";
import type { ReportType } from "@/app/(app)/reports/config";
import type { Json } from "@/lib/database.types";
import type { OrgContext } from "@/lib/context";
import { one } from "@/lib/utils";
import { localStamp, type Cell } from "./csv";

export type ExportParams = { from: string; to: string; fromUtc: string; toUtc: string; country: string | null; tz: string };
export type ReportSpec = { headers: string[]; batches: AsyncGenerator<Cell[][]> };
type DbErr = { message?: string; code?: string } | null;

export class ExportError extends Error {
  constructor(public readonly db: DbErr) { super(db?.message ?? "export failed"); }
}

const MAX_ROWS = 100_000;

async function* pages<T>(page: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: DbErr }>, size = 1000): AsyncGenerator<T[]> {
  for (let off = 0; off < MAX_ROWS; off += size) {
    const { data, error } = await page(off, off + size - 1);
    if (error) throw new ExportError(error);
    const rows = data ?? [];
    if (rows.length) yield rows;
    if (rows.length < size) return;
  }
}

async function* single(rows: Cell[][]): AsyncGenerator<Cell[][]> {
  if (rows.length) yield rows;
}

function hoursBetween(a: string, b: string | null) {
  return Math.max(0, ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 3_600_000);
}

function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function prodText(v: Json | null | undefined, ctx: OrgContext) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return Object.entries(v).map(([u, q]) => `${q} ${ctx.label("production.units", u)}`).join("; ") || null;
}

export async function buildReport(type: ReportType, ctx: OrgContext, p: ExportParams): Promise<ReportSpec> {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const ts = localStamp(p.tz);
  const col = (k: string) => ctx.label("reports.columns", k);
  const countryName = (id: string | null | undefined) => ctx.countries.find((c) => c.id === id)?.name ?? null;
  const lookups = async () => {
    const { data } = await sb.from("lookup_values").select("kind, key, label").eq("organization_id", org);
    const m = new Map((data ?? []).map((l) => [`${l.kind}:${l.key}`, l.label ?? l.key]));
    return (kind: string, key: string | null | undefined) => (key ? m.get(`${kind}:${key}`) ?? key : null);
  };

  switch (type) {
    /* ------------------------------------------------------------ hours */
    case "hours": {
      const lk = await lookups();
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => sb.from("work_logs")
          .select("id, started_at, ended_at, status, work_type, notes, employee:employees(full_name, country_id), project:projects(code, name, country_id), machine:machines(name)")
          .eq("organization_id", org).is("deleted_at", null).gte("started_at", p.fromUtc).lt("started_at", p.toUtc)
          .order("started_at").order("id").range(a, b), 500)) {
          const rows = p.country ? batch.filter((r) => (one(r.project)?.country_id ?? one(r.employee)?.country_id) === p.country) : batch;
          if (!rows.length) continue;
          const ids = rows.map((r) => r.id);
          const br = await fetchAll((a, b) => sb.from("work_breaks").select("work_log_id, started_at, ended_at").in("work_log_id", ids).order("id").range(a, b), 50_000);
          if (br.error) throw new ExportError(br.error);
          const breaks = new Map<string, number>();
          for (const x of br.rows) breaks.set(x.work_log_id, (breaks.get(x.work_log_id) ?? 0) + hoursBetween(x.started_at, x.ended_at));
          yield rows.map((r) => {
            const gross = hoursBetween(r.started_at, r.ended_at);
            const brk = Math.min(gross, breaks.get(r.id) ?? 0);
            const emp = one(r.employee);
            const prj = one(r.project);
            return [ts.date(r.started_at), emp?.full_name ?? null, countryName(prj?.country_id ?? emp?.country_id), prj?.code ?? null, prj?.name ?? null,
              one(r.machine)?.name ?? null, lk("work_type", r.work_type), ts.dateTime(r.started_at), ts.dateTime(r.ended_at),
              round(gross), round(brk), round(gross - brk), ctx.label("hours.status", r.status), r.notes];
          });
        }
      }
      return {
        headers: ["date", "employee", "country", "project", "projectName", "machine", "workType", "start", "end", "grossHours", "breakHours", "netHours", "status", "notes"].map(col),
        batches: gen(),
      };
    }

    /* ------------------------------------------------------------ fuel */
    case "fuel": {
      const lk = await lookups();
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => {
          let q = sb.from("fuel_logs")
            .select("id, occurred_at, fuel_type, litres, price_per_litre, total_amount, currency, engine_hours, location_text, notes, country_id, employee:employees(full_name), machine:machines(name), project:projects(code)")
            .eq("organization_id", org).is("deleted_at", null).gte("occurred_at", p.fromUtc).lt("occurred_at", p.toUtc);
          if (p.country) q = q.eq("country_id", p.country);
          return q.order("occurred_at").order("id").range(a, b);
        })) {
          yield batch.map((r) => [ts.date(r.occurred_at), ts.time(r.occurred_at), one(r.machine)?.name ?? null, one(r.project)?.code ?? null,
            one(r.employee)?.full_name ?? null, countryName(r.country_id), lk("fuel_type", r.fuel_type), r.litres, r.price_per_litre,
            r.total_amount, r.currency, r.engine_hours, r.location_text, r.notes]);
        }
      }
      return {
        headers: ["date", "time", "machine", "project", "employee", "country", "fuelType", "litres", "pricePerLitre", "totalAmount", "currency", "engineHours", "location", "notes"].map(col),
        batches: gen(),
      };
    }

    /* ------------------------------------------------------------ expenses */
    case "expenses": {
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => {
          let q = sb.from("expenses")
            .select("id, expense_date, category, amount, currency, status, description, country_id, employee:employees(full_name), project:projects(code), machine:machines(name)")
            .eq("organization_id", org).is("deleted_at", null).gte("expense_date", p.from).lte("expense_date", p.to);
          if (p.country) q = q.eq("country_id", p.country);
          return q.order("expense_date").order("id").range(a, b);
        })) {
          yield batch.map((r) => [r.expense_date, ctx.label("expenses.categories", r.category), r.amount, r.currency, ctx.label("expenses.status", r.status),
            one(r.employee)?.full_name ?? null, one(r.project)?.code ?? null, one(r.machine)?.name ?? null, countryName(r.country_id), r.description]);
        }
      }
      return {
        headers: ["date", "category", "amount", "currency", "status", "employee", "project", "machine", "country", "description"].map(col),
        batches: gen(),
      };
    }

    /* ------------------------------------------------------------ machines */
    case "machines": {
      const [costs, master] = await Promise.all([
        sb.rpc("analytics_machine_costs", { p_org: org, p_from: p.from, p_to: p.to, p_country: p.country ?? undefined }),
        fetchAll((a, b) => sb.from("machines").select("id, registration_number, status").eq("organization_id", org).is("deleted_at", null).order("id").range(a, b)),
      ]);
      if (costs.error) throw new ExportError(costs.error);
      const m = new Map(master.rows.map((x) => [x.id, x]));
      const rows: Cell[][] = (costs.data ?? []).map((r) => {
        const x = m.get(r.machine_id);
        return [r.name, ctx.label("machines.categories", r.category), x?.registration_number ?? null, x ? ctx.label("machines.status", x.status) : null,
          countryName(r.country_id), r.work_hours, r.engine_hours_used, r.fuel_litres, r.fuel_cost, r.maintenance_cost, r.repair_cost, r.total_cost,
          r.cost_per_hour, r.repairs_count, r.downtime_hours];
      });
      return {
        headers: ["name", "category", "registration", "status", "country", "workHours", "engineHoursUsed", "fuelLitres", "fuelCost", "maintenanceCost",
          "repairCost", "totalCost", "costPerHour", "repairsCount", "downtimeHours"].map(col),
        batches: single(rows),
      };
    }

    /* ------------------------------------------------------------ maintenance + repairs */
    case "maintenance": {
      const lk = await lookups();
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => sb.from("maintenance_records")
          .select("id, performed_at, maintenance_type, description, engine_hours, cost, currency, external_service, machine:machines(name, country_id)")
          .eq("organization_id", org).is("deleted_at", null).gte("performed_at", p.from).lte("performed_at", p.to)
          .order("performed_at").order("id").range(a, b))) {
          const rows = p.country ? batch.filter((r) => one(r.machine)?.country_id === p.country) : batch;
          if (rows.length) yield rows.map((r) => [r.performed_at, ctx.label("reports.kinds", "maintenance"), one(r.machine)?.name ?? null,
            ctx.label("maintenance.type", r.maintenance_type), [r.description, r.external_service].filter(Boolean).join(" · ") || null, null, null,
            r.engine_hours, null, null, r.cost, r.currency, null]);
        }
        for await (const batch of pages((a, b) => sb.from("repair_requests")
          .select("id, created_at, title, category, status, priority, labour_cost, external_cost, currency, downtime_hours, machine:machines(name, country_id), repair_parts(quantity, unit_cost, currency)")
          .eq("organization_id", org).is("deleted_at", null).gte("created_at", p.fromUtc).lt("created_at", p.toUtc)
          .order("created_at").order("id").range(a, b), 500)) {
          const rows = p.country ? batch.filter((r) => one(r.machine)?.country_id === p.country) : batch;
          if (rows.length) yield rows.map((r) => {
            const parts = (r.repair_parts ?? []).filter((x) => x.currency === r.currency).reduce((s, x) => s + Number(x.quantity) * Number(x.unit_cost ?? 0), 0);
            const total = Number(r.labour_cost ?? 0) + Number(r.external_cost ?? 0) + parts;
            return [ts.date(r.created_at), ctx.label("reports.kinds", "repair"), one(r.machine)?.name ?? null, lk("problem_category", r.category), r.title,
              ctx.label("repairs.status", r.status), ctx.label("repairs.priority", r.priority), null, r.labour_cost, r.external_cost,
              total > 0 ? round(total) : null, r.currency, r.downtime_hours];
          });
        }
      }
      return {
        headers: ["date", "kind", "machine", "type", "description", "status", "priority", "engineHours", "labourCost", "externalCost", "totalAmount", "currency", "downtimeHours"].map(col),
        batches: gen(),
      };
    }

    /* ------------------------------------------------------------ projects */
    case "projects": {
      const { data, error } = await sb.rpc("analytics_project_summary", { p_org: org, p_from: p.from, p_to: p.to, p_country: p.country ?? undefined });
      if (error) throw new ExportError(error);
      const rows: Cell[][] = (data ?? []).map((r) => [r.code, r.name, countryName(r.country_id), ctx.label("projects.status", r.status), r.hours, r.workers,
        r.machines, r.fuel_litres, r.fuel_cost, r.expenses, prodText(r.production, ctx), r.repairs, r.downtime_hours]);
      return {
        headers: ["code", "name", "country", "status", "workHours", "workers", "machines", "fuelLitres", "fuelCost", "expensesEur", "production", "repairsCount", "downtimeHours"].map(col),
        batches: single(rows),
      };
    }

    /* ------------------------------------------------------------ production */
    case "production": {
      const lk = await lookups();
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => sb.from("production_logs")
          .select("id, production_date, quantity, unit, unit_label, work_type, notes, project:projects(code, name, country_id), employee:employees(full_name), team:teams(name), machine:machines(name)")
          .eq("organization_id", org).is("deleted_at", null).gte("production_date", p.from).lte("production_date", p.to)
          .order("production_date").order("id").range(a, b))) {
          const rows = p.country ? batch.filter((r) => one(r.project)?.country_id === p.country) : batch;
          if (rows.length) yield rows.map((r) => {
            const prj = one(r.project);
            return [r.production_date, prj?.code ?? null, prj?.name ?? null, one(r.employee)?.full_name ?? null, one(r.team)?.name ?? null,
              one(r.machine)?.name ?? null, r.quantity, r.unit_label || ctx.label("production.units", r.unit), lk("work_type", r.work_type), r.notes];
          });
        }
      }
      return {
        headers: ["date", "project", "projectName", "employee", "team", "machine", "quantity", "unit", "workType", "notes"].map(col),
        batches: gen(),
      };
    }

    /* ------------------------------------------------------------ safety acknowledgements (current state) */
    case "safety": {
      const headers = ["employee", "country", "section", "rule", "version", "acknowledged", "acknowledgedAt"].map(col);
      const { data: rulesData, error } = await sb.from("safety_rules").select("id, section, title, country_id, current_version, sort_order")
        .eq("organization_id", org).eq("is_active", true).eq("requires_acknowledgement", true).order("section").order("sort_order");
      if (error) throw new ExportError(error);
      const rules = (rulesData ?? []).filter((r) => !p.country || !r.country_id || r.country_id === p.country);
      if (!rules.length) return { headers, batches: single([]) };
      let eq = sb.from("employees").select("id, full_name, country_id").eq("organization_id", org).is("deleted_at", null).is("archived_at", null)
        .eq("status", "active").not("user_id", "is", null).order("full_name");
      if (p.country) eq = eq.eq("country_id", p.country);
      const [emps, vers] = await Promise.all([eq, sb.from("safety_rule_versions").select("id, rule_id, version").in("rule_id", rules.map((r) => r.id))]);
      if (emps.error) throw new ExportError(emps.error);
      const vid = new Map(rules.map((r) => [r.id, (vers.data ?? []).find((v) => v.rule_id === r.id && v.version === r.current_version)?.id]));
      const ids = [...vid.values()].filter((x): x is string => Boolean(x));
      const acks = ids.length
        ? await fetchAll((a, b) => sb.from("safety_acknowledgements").select("rule_version_id, employee_id, acknowledged_at").in("rule_version_id", ids).order("id").range(a, b), 200_000)
        : { rows: [] as { rule_version_id: string; employee_id: string; acknowledged_at: string }[], error: null };
      if (acks.error) throw new ExportError(acks.error);
      const ackAt = new Map(acks.rows.map((a) => [`${a.rule_version_id}:${a.employee_id}`, a.acknowledged_at]));
      const rows: Cell[][] = [];
      for (const e of emps.data ?? []) {
        for (const r of rules) {
          if (r.country_id && r.country_id !== e.country_id) continue;
          const at = ackAt.get(`${vid.get(r.id)}:${e.id}`) ?? null;
          rows.push([e.full_name, countryName(e.country_id), ctx.label("safety.sections", r.section), r.title, r.current_version,
            at ? ctx.t("reports.yes") : ctx.t("reports.no"), ts.dateTime(at)]);
        }
      }
      return { headers, batches: single(rows) };
    }

    /* ------------------------------------------------------------ incidents */
    case "incidents": {
      async function* gen(): AsyncGenerator<Cell[][]> {
        for await (const batch of pages((a, b) => sb.from("incidents")
          .select("id, occurred_at, incident_type, severity, status, title, location_text, latitude, longitude, description, immediate_action, manager_response, investigation, corrective_action, closed_at, project:projects(code, country_id), machine:machines(name), employee:employees(full_name)")
          .eq("organization_id", org).is("deleted_at", null).gte("occurred_at", p.fromUtc).lt("occurred_at", p.toUtc)
          .order("occurred_at").order("id").range(a, b))) {
          const rows = p.country ? batch.filter((r) => { const pr = one(r.project); return !pr || pr.country_id === p.country; }) : batch;
          if (rows.length) yield rows.map((r) => [ts.dateTime(r.occurred_at), ctx.label("incidents.type", r.incident_type), ctx.label("incidents.severity", r.severity),
            ctx.label("incidents.status", r.status), r.title, one(r.project)?.code ?? null, one(r.machine)?.name ?? null, one(r.employee)?.full_name ?? null,
            r.location_text, r.latitude, r.longitude, r.description, r.immediate_action, r.manager_response, r.investigation, r.corrective_action,
            ts.dateTime(r.closed_at)]);
        }
      }
      return {
        headers: ["occurredAt", "type", "severity", "status", "title", "project", "machine", "employee", "location", "latitude", "longitude", "description",
          "immediateAction", "managerResponse", "investigation", "correctiveAction", "closedAt"].map(col),
        batches: gen(),
      };
    }
  }
}
