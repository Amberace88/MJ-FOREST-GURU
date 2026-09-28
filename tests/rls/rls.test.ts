/**
 * Row Level Security & authorization tests.
 *
 * Runs against a real PostgreSQL database with all migrations applied:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/mjfg_test npm run test:db
 *
 * Each test impersonates a user exactly like Supabase/PostgREST does:
 * `set local role authenticated` + `request.jwt.claims` inside a rolled-back transaction.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB = process.env.DATABASE_URL;
const ROOT = path.resolve(__dirname, "../..");

const U = {
  ownerA: "00000000-0000-0000-0000-00000000000a",
  managerA: "00000000-0000-0000-0000-00000000000b",
  foremanA: "00000000-0000-0000-0000-00000000000c",
  mechanicA: "00000000-0000-0000-0000-00000000000d",
  employeeA: "00000000-0000-0000-0000-00000000000e",
  ownerB: "00000000-0000-0000-0000-0000000000b1",
  employeeB: "00000000-0000-0000-0000-0000000000b2",
  outsider: "00000000-0000-0000-0000-0000000000ff",
};

let db: Client;
let orgA: string;
let orgB: string;

type Row = Record<string, unknown>;

async function as<T>(user: string | "anon", fn: (q: (sql: string, params?: unknown[]) => Promise<Row[]>) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (user === "anon") {
      await db.query("set local role anon");
      await db.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else {
      await db.query("set local role authenticated");
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user, role: "authenticated" })]);
    }
    const q = async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows as Row[];
    return await fn(q);
  } finally {
    await db.query("rollback");
  }
}

/** Runs a statement that must fail; returns the SQLSTATE / message. */
async function expectFailure(user: string | "anon", sql: string, params?: unknown[]): Promise<string> {
  return as(user, async (q) => {
    await db.query("savepoint s");
    try {
      await q(sql, params);
    } catch (e) {
      await db.query("rollback to savepoint s");
      const err = e as { code?: string; message: string };
      return `${err.code ?? ""} ${err.message}`;
    }
    throw new Error(`Expected failure but statement succeeded: ${sql}`);
  });
}

describe.skipIf(!DB)("RLS & authorization", () => {
  beforeAll(async () => {
    execSync(`${ROOT}/scripts/db-test-setup.sh`, { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -q -f ${ROOT}/tests/db/fixtures.sql`, { stdio: "pipe" });
    db = new Client({ connectionString: DB });
    await db.connect();
    orgA = (await db.query(`select id from organizations where slug = 'org-a'`)).rows[0].id;
    orgB = (await db.query(`select id from organizations where slug = 'org-b'`)).rows[0].id;
  }, 120_000);

  afterAll(async () => {
    await db?.end();
  });

  // ------------------------------------------------------------------ anonymous
  describe("anonymous", () => {
    it("cannot read company tables", async () => {
      for (const t of ["employees", "projects", "machines", "expenses", "work_logs", "fuel_logs", "audit_logs", "files"]) {
        const err = await expectFailure("anon", `select * from public.${t} limit 1`);
        expect(err).toMatch(/42501|permission denied/);
      }
    });
    it("cannot call dashboard RPCs", async () => {
      const err = await expectFailure("anon", `select public.dashboard_stats($1)`, [orgA]);
      expect(err).toMatch(/42501|permission denied/);
    });
    it("cannot read private storage objects", async () => {
      const rows = await as("anon", (q) => q(`select * from storage.objects where bucket_id = 'receipts'`));
      expect(rows).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------ owner
  describe("owner", () => {
    it("sees the whole organization", async () => {
      const r = await as(U.ownerA, async (q) => ({
        employees: (await q(`select count(*)::int n from employees where organization_id = $1`, [orgA]))[0].n,
        projects: (await q(`select count(*)::int n from projects where organization_id = $1`, [orgA]))[0].n,
        machines: (await q(`select count(*)::int n from machines where organization_id = $1`, [orgA]))[0].n,
        expenses: (await q(`select count(*)::int n from expenses where organization_id = $1`, [orgA]))[0].n,
        audit: (await q(`select count(*)::int n from audit_logs where organization_id = $1`, [orgA]))[0].n,
      }));
      expect(r.employees).toBeGreaterThanOrEqual(17);
      expect(r.projects).toBe(7);
      expect(r.machines).toBe(11);
      expect(r.expenses).toBeGreaterThan(20);
      expect(r.audit).toBeGreaterThan(0);
    });
    it("cannot see another organization (cross-org isolation)", async () => {
      const r = await as(U.ownerA, (q) => q(`select count(*)::int n from projects where organization_id = $1`, [orgB]));
      expect(r[0].n).toBe(0);
      const r2 = await as(U.ownerB, (q) => q(`select count(*)::int n from employees where organization_id = $1`, [orgA]));
      expect(r2[0].n).toBe(0);
    });
    it("cannot write into another organization", async () => {
      const err = await expectFailure(U.ownerB, `insert into projects (organization_id, country_id, code, name) select $1, id, 'X-1', 'x' from countries limit 1`, [orgA]);
      expect(err).toMatch(/row-level security|CROSS_ORG|42501/);
    });
    it("cannot read integration secrets", async () => {
      const err = await expectFailure(U.ownerA, `select * from integration_secrets`);
      expect(err).toMatch(/42501|permission denied/);
    });
    it("audit log is append-only even for the owner", async () => {
      const del = await as(U.ownerA, (q) => q(`delete from audit_logs where organization_id = $1 returning id`, [orgA]).catch((e) => e));
      expect(String(del)).toMatch(/permission denied|42501/);
    });
  });

  // ------------------------------------------------------------------ employee
  describe("employee", () => {
    it("can read own employee record and profile", async () => {
      const r = await as(U.employeeA, async (q) => ({
        emp: await q(`select id, full_name, user_id from employees`),
        prof: await q(`select id from profiles where id = $1`, [U.employeeA]),
      }));
      expect(r.emp).toHaveLength(1);
      expect(r.emp[0].user_id).toBe(U.employeeA);
      expect(r.emp[0].full_name).toBe("Jānis Bērziņš");
      expect(r.prof).toHaveLength(1);
    });
    it("cannot read other restricted employees", async () => {
      const other = (await db.query(`select id from employees where organization_id = $1 and full_name = 'Mārtiņš Ozols'`, [orgA])).rows[0].id;
      const r = await as(U.employeeA, (q) => q(`select * from employees where id = $1`, [other]));
      expect(r).toHaveLength(0);
    });
    it("can read assigned project but not unrelated projects", async () => {
      const r = await as(U.employeeA, (q) => q(`select code from projects order by code`));
      const codes = r.map((x) => x.code);
      expect(codes).toContain("SE-042");
      expect(codes).not.toContain("LV-018");
      expect(codes).not.toContain("B-001");
    });
    it("cannot access company finances or salaries", async () => {
      const r = await as(U.employeeA, async (q) => ({
        othersExpenses: (await q(`select count(*)::int n from expenses where employee_id <> (select id from employees where user_id = $1)`, [U.employeeA]))[0].n,
        comp: (await q(`select count(*)::int n from employee_compensation`))[0].n,
        allFuel: (await q(`select count(*)::int n from fuel_logs where employee_id is distinct from (select id from employees where user_id = $1)`, [U.employeeA]))[0].n,
        audit: (await q(`select count(*)::int n from audit_logs`))[0].n,
      }));
      expect(r.othersExpenses).toBe(0);
      expect(r.comp).toBe(0);
      expect(r.allFuel).toBe(0);
      expect(r.audit).toBe(0);
    });
    it("cannot see unrestricted GPS history", async () => {
      const r = await as(U.employeeA, (q) => q(`select count(*)::int n from gps_positions where machine_id is not null`));
      expect(r[0].n).toBe(0);
    });
    it("cannot update projects or other people's work logs (0 rows affected)", async () => {
      const r = await as(U.employeeA, async (q) => ({
        proj: await q(`update projects set name = 'hacked' where organization_id = $1 returning id`, [orgA]),
        logs: await q(`update work_logs set notes = 'x' where employee_id <> (select id from employees where user_id = $1) returning id`, [U.employeeA]),
      }));
      expect(r.proj).toHaveLength(0);
      expect(r.logs).toHaveLength(0);
    });
    it("cannot delete business records", async () => {
      const r = await as(U.employeeA, async (q) => ({
        exp: await q(`delete from expenses returning id`),
        logs: await q(`delete from work_logs returning id`),
      }));
      expect(r.exp).toHaveLength(0);
      expect(r.logs).toHaveLength(0);
    });
    it("cannot approve an expense", async () => {
      const err = await expectFailure(U.employeeA,
        `insert into expenses (organization_id, expense_date, amount, currency, category, description, status, employee_id)
         values ($1, current_date, 10, 'EUR', 'food', 'x', 'approved', (select id from employees where user_id = $2))`, [orgA, U.employeeA]);
      expect(err).toMatch(/PERMISSION_DENIED/);
    });
    it("can check in for self, not for others; duplicate check-in is rejected", async () => {
      const other = (await db.query(`select id from employees where organization_id = $1 and full_name = 'Mārtiņš Ozols'`, [orgA])).rows[0].id;
      await as(U.employeeA, async (q) => {
        const me = (await q(`select id from employees where user_id = $1`, [U.employeeA]))[0].id;
        await q(`update work_logs set ended_at = now() where employee_id = $1 and ended_at is null`, [me]);
        const ins = await q(`insert into work_logs (organization_id, employee_id, started_at, idempotency_key) values ($1, $2, now() - interval '1 minute', 'k1') returning id`, [orgA, me]);
        expect(ins).toHaveLength(1);
        await db.query("savepoint a");
        await expect(q(`insert into work_logs (organization_id, employee_id, started_at) values ($1, $2, now())`, [orgA, me])).rejects.toThrow(/uq_work_logs_one_active|duplicate/);
        await db.query("rollback to savepoint a");
        await expect(q(`insert into work_logs (organization_id, employee_id, started_at) values ($1, $2, now())`, [orgA, other])).rejects.toThrow(/row-level security/);
      });
    });
    it("rejects impossible data (checkout before check-in, negative fuel)", async () => {
      await as(U.employeeA, async (q) => {
        const me = (await q(`select id from employees where user_id = $1`, [U.employeeA]))[0].id;
        await db.query("savepoint a");
        await expect(q(`insert into work_logs (organization_id, employee_id, started_at, ended_at) values ($1, $2, now() - interval '1 hour', now() - interval '2 hours')`, [orgA, me])).rejects.toThrow(/work_logs_end_after_start/);
        await db.query("rollback to savepoint a");
        await expect(q(`insert into fuel_logs (organization_id, occurred_at, employee_id, litres) values ($1, now(), $2, -5)`, [orgA, me])).rejects.toThrow(/check constraint/);
      });
    });
    it("cannot modify a closed shift (only managers correct hours)", async () => {
      const err = await expectFailure(U.employeeA,
        `update work_logs set ended_at = ended_at + interval '1 hour' where employee_id = (select id from employees where user_id = $1) and ended_at is not null`, [U.employeeA]);
      expect(err).toMatch(/PERMISSION_DENIED/);
    });
    it("cannot read private files it has no access to", async () => {
      const r = await as(U.employeeA, (q) => q(`select name from storage.objects where bucket_id = 'receipts'`));
      const visibleFiles = await as(U.employeeA, (q) => q(`select path from files`));
      expect(r.length).toBe(visibleFiles.length); // storage visibility mirrors files RLS
    });
  });

  // ------------------------------------------------------------------ manager
  describe("manager", () => {
    it("reads assigned team, not other teams", async () => {
      const r = await as(U.managerA, (q) => q(`select full_name, country_id from employees`));
      const names = r.map((x) => x.full_name);
      expect(names).toContain("Jānis Bērziņš"); // SE team 03 (manager of team)
      expect(names).not.toContain("Andris Kalniņš"); // LV team
    });
    it("reads only assigned projects", async () => {
      const r = await as(U.managerA, (q) => q(`select code from projects`));
      const codes = r.map((x) => x.code);
      expect(codes).toEqual(expect.arrayContaining(["SE-042", "SE-045"]));
      expect(codes).not.toContain("LV-018");
      expect(codes).not.toContain("IS-007");
    });
    it("cannot read another organization", async () => {
      const r = await as(U.managerA, (q) => q(`select count(*)::int n from expenses where organization_id = $1`, [orgB]));
      expect(r[0].n).toBe(0);
    });
    it("cannot create projects (no org-wide project permission)", async () => {
      const err = await expectFailure(U.managerA, `insert into projects (organization_id, country_id, code, name) select $1, id, 'SE-999', 'x' from countries where organization_id = $1 limit 1`, [orgA]);
      expect(err).toMatch(/row-level security/);
    });
    it("cannot update unrelated project", async () => {
      const r = await as(U.managerA, (q) => q(`update projects set notes = 'x' where code = 'LV-018' returning id`));
      expect(r).toHaveLength(0);
    });
    it("cannot see full company finance (only assigned-project expenses)", async () => {
      const r = await as(U.managerA, (q) => q(`select distinct p.code from expenses x join projects p on p.id = x.project_id`));
      for (const row of r) expect(["SE-042", "SE-045"]).toContain(row.code);
    });
    it("cannot read salaries or audit log", async () => {
      const r = await as(U.managerA, async (q) => ({
        comp: (await q(`select count(*)::int n from employee_compensation`))[0].n,
        audit: (await q(`select count(*)::int n from audit_logs`))[0].n,
      }));
      expect(r.comp).toBe(0);
      expect(r.audit).toBe(0);
    });
    it("can approve an expense in its project", async () => {
      const r = await as(U.managerA, (q) =>
        q(`update expenses set status = 'approved' where status = 'submitted' and project_id in (select id from projects where code in ('SE-042','SE-045')) returning id, decided_by`));
      for (const row of r) expect(row.decided_by).toBe(U.managerA);
    });
    it("cannot grant itself privileged roles", async () => {
      const err = await expectFailure(U.managerA,
        `insert into user_roles (organization_id, user_id, role_id) select $1, $2, id from roles where organization_id = $1 and key = 'owner'`, [orgA, U.managerA]);
      expect(err).toMatch(/row-level security|PERMISSION_DENIED/);
    });
  });

  // ------------------------------------------------------------------ mechanic
  describe("mechanic", () => {
    it("sees repair requests and can update status + parts", async () => {
      await as(U.mechanicA, async (q) => {
        const reps = await q(`select id, status from repair_requests where status not in ('completed','cancelled')`);
        expect(reps.length).toBeGreaterThan(0);
        const upd = await q(`update repair_requests set status = 'in_progress', labour_hours = 2 where id = $1 returning status`, [reps[0].id]);
        expect(upd).toHaveLength(1);
        const part = await q(`insert into repair_parts (organization_id, repair_id, name, quantity, unit_cost) values ($1, $2, 'Filtrs', 1, 25) returning id`, [orgA, reps[0].id]);
        expect(part).toHaveLength(1);
        const hist = await q(`select count(*)::int n from repair_status_history where repair_id = $1`, [reps[0].id]);
        expect(hist[0].n).toBeGreaterThan(0);
      });
    });
    it("cannot see finance", async () => {
      const r = await as(U.mechanicA, (q) => q(`select count(*)::int n from expenses where created_by is distinct from $1`, [U.mechanicA]));
      // mechanic only sees own expenses (created or as employee)
      const own = await as(U.mechanicA, (q) => q(`select count(*)::int n from expenses x join employees e on e.id = x.employee_id where e.user_id = $1`, [U.mechanicA]));
      expect(r[0].n).toBe(own[0].n);
    });
  });

  // ------------------------------------------------------------------ employee cannot change repair workflow
  describe("repairs", () => {
    it("reporter cannot change repair status", async () => {
      await as(U.employeeA, async (q) => {
        const m = await q(`select id from machines limit 1`);
        const rep = await q(`insert into repair_requests (organization_id, machine_id, title, priority) values ($1, $2, 'Test', 'low') returning id`, [orgA, m[0].id]);
        await expect(q(`update repair_requests set status = 'completed' where id = $1`, [rep[0].id])).rejects.toThrow(/PERMISSION_DENIED/);
      });
    });
  });

  // ------------------------------------------------------------------ audit
  describe("audit", () => {
    it("work-hour correction by owner is audited as work_hours_corrected", async () => {
      await as(U.ownerA, async (q) => {
        const log = await q(`select id from work_logs where organization_id = $1 and ended_at is not null order by started_at desc limit 1`, [orgA]);
        await q(`update work_logs set ended_at = ended_at + interval '30 minutes' where id = $1`, [log[0].id]);
        const a = await q(`select action, old_values, new_values from audit_logs where entity = 'work_logs' and entity_id = $1 order by id desc limit 1`, [log[0].id]);
        expect(a[0].action).toBe("work_hours_corrected");
        expect(a[0].old_values).toHaveProperty("ended_at");
        const st = await q(`select status from work_logs where id = $1`, [log[0].id]);
        expect(st[0].status).toBe("corrected");
      });
    });
    it("employee cannot read the audit log", async () => {
      const r = await as(U.employeeA, (q) => q(`select count(*)::int n from audit_logs`));
      expect(r[0].n).toBe(0);
    });
  });

  // ------------------------------------------------------------------ storage
  describe("private storage", () => {
    it("owner can read the object, other org cannot, outsider cannot", async () => {
      const own = await as(U.ownerA, (q) => q(`select name from storage.objects where bucket_id = 'receipts'`));
      expect(own.length).toBeGreaterThan(0);
      const other = await as(U.ownerB, (q) => q(`select name from storage.objects where bucket_id = 'receipts'`));
      expect(other).toHaveLength(0);
      const outsider = await as(U.outsider, (q) => q(`select name from storage.objects`));
      expect(outsider).toHaveLength(0);
    });
    it("cannot upload into another organization's folder", async () => {
      const err = await expectFailure(U.ownerB, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${orgA}/expense/x/evil.jpg`]);
      expect(err).toMatch(/row-level security/);
    });
    it("buckets are private", async () => {
      const r = await db.query(`select id, public from storage.buckets where id in ('receipts','documents','media')`);
      expect(r.rows).toHaveLength(3);
      for (const b of r.rows) expect(b.public).toBe(false);
    });
  });

  // ------------------------------------------------------------------ companies
  describe("companies", () => {
    it("owner creates companies; members read them; employee and manager cannot write", async () => {
      const r = await as(U.ownerA, async (q) => {
        const id = (await q(`insert into companies (organization_id, name, color) values ($1, 'Land Guru', '#3a7a48') returning id`, [orgA]))[0].id;
        return { id, n: (await q(`select count(*)::int n from companies where organization_id = $1`, [orgA]))[0].n };
      });
      expect(r.n).toBe(1);
      for (const user of [U.employeeA, U.managerA]) {
        const err = await expectFailure(user, `insert into companies (organization_id, name) values ($1, 'X SIA')`, [orgA]);
        expect(err).toMatch(/row-level security/);
      }
      const bad = await expectFailure(U.ownerA, `insert into companies (organization_id, name, color) values ($1, 'Y', 'red')`, [orgA]);
      expect(bad).toMatch(/23514|check constraint/);
    });
    it("another organization cannot read or reference them; delete is a no-op", async () => {
      await db.query("begin");
      try {
        const a = (await db.query(`insert into companies (organization_id, name) values ($1, 'Skog Guru') returning id`, [orgA])).rows[0].id;
        await db.query("set local role authenticated");
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.ownerB, role: "authenticated" })]);
        expect((await db.query(`select count(*)::int n from companies where id = $1`, [a])).rows[0].n).toBe(0);
        await db.query("savepoint s");
        await expect(db.query(`update projects set company_id = $1 where organization_id = $2`, [a, orgB])).rejects.toThrow(/CROSS_ORG_REFERENCE/);
        await db.query("rollback to savepoint s");
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.ownerA, role: "authenticated" })]);
        const del = await db.query(`delete from companies where id = $1`, [a]);
        expect(del.rowCount).toBe(0);
      } finally {
        await db.query("rollback");
      }
    });
    it("expenses inherit the project's company", async () => {
      const r = await as(U.ownerA, async (q) => {
        const c = (await q(`insert into companies (organization_id, name) values ($1, 'Land Guru') returning id`, [orgA]))[0].id;
        const p = (await q(`update projects set company_id = $1 where id = (select id from projects where organization_id = $2 order by code limit 1) returning id`, [c, orgA]))[0].id;
        const e = await q(`insert into expenses (organization_id, expense_date, amount, currency, category, description, status, project_id)
                           values ($1, current_date, 10, 'EUR', 'food', 'x', 'draft', $2) returning company_id`, [orgA, p]);
        return { c, company: e[0].company_id };
      });
      expect(r.company).toBe(r.c);
    });
  });

  // ------------------------------------------------------------------ outsider
  describe("authenticated outsider (no membership)", () => {
    it("sees nothing", async () => {
      const r = await as(U.outsider, async (q) => ({
        orgs: (await q(`select count(*)::int n from organizations`))[0].n,
        emp: (await q(`select count(*)::int n from employees`))[0].n,
        stats: (await q(`select public.dashboard_stats($1) s`, [orgA]))[0].s as Record<string, number>,
      }));
      expect(r.orgs).toBe(0);
      expect(r.emp).toBe(0);
      expect(r.stats.employees_total).toBe(0);
      expect(r.stats.machines_total).toBe(0);
    });
  });

  // ------------------------------------------------------------------ schema guarantees
  describe("schema", () => {
    it("every public table has RLS enabled", async () => {
      const r = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
      expect(r.rows).toHaveLength(0);
    });
    it("bootstrap and demo seed are not callable by authenticated users", async () => {
      const err = await expectFailure(U.ownerA, `select public.seed_demo_data($1, '{}'::jsonb)`, [orgA]);
      expect(err).toMatch(/permission denied/);
    });
    it("demo seed refuses non-demo organizations", async () => {
      await expect(db.query(`select public.seed_demo_data($1, '{}'::jsonb)`, [orgB])).rejects.toThrow(/DEMO_SEED_REFUSED/);
    });
  });
});
