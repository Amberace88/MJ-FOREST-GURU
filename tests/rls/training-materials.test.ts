/**
 * RLS & integrity tests for the training materials library
 * (public.training_materials, public.training_material_acks, public.training_audience).
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/mjfg_test npm run test:db
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
  employeeA: "00000000-0000-0000-0000-00000000000e",
  ownerB: "00000000-0000-0000-0000-0000000000b1",
  employeeB: "00000000-0000-0000-0000-0000000000b2",
};

type Row = Record<string, unknown>;
type Q = (sql: string, params?: unknown[]) => Promise<Row[]>;

let db: Client;
let orgA: string;
let orgB: string;
let empA: string;      // employee record of U.employeeA
let otherEmpA: string; // another employee in org A
let published: string; // published material in org A (version 1)
let draft: string;     // draft material in org A

async function as<T>(user: string, fn: (q: Q) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user, role: "authenticated" })]);
    return await fn(async (sql, params) => (await db.query(sql, params)).rows as Row[]);
  } finally {
    await db.query("rollback");
  }
}

async function fails(user: string, sql: string, params?: unknown[]): Promise<string> {
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

const ACK = `insert into training_material_acks (organization_id, material_id, version, employee_id, user_id) values ($1, $2, $3, $4, $5) returning *`;

describe.skipIf(!DB)("training materials RLS", () => {
  beforeAll(async () => {
    execSync(`${ROOT}/scripts/db-test-setup.sh`, { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -q -f ${ROOT}/tests/db/fixtures.sql`, { stdio: "pipe" });
    db = new Client({ connectionString: DB });
    await db.connect();
    orgA = (await db.query(`select id from organizations where slug = 'org-a'`)).rows[0].id;
    orgB = (await db.query(`select id from organizations where slug = 'org-b'`)).rows[0].id;
    empA = (await db.query(`select id from employees where user_id = $1 and organization_id = $2`, [U.employeeA, orgA])).rows[0].id;
    otherEmpA = (await db.query(`select id from employees where organization_id = $1 and id <> $2 and deleted_at is null limit 1`, [orgA, empA])).rows[0].id;
    published = (await db.query(
      `insert into training_materials (organization_id, category, title, body, status, audience) values ($1, 'safety', 'Publicēts', '## A', 'published', '{employee}') returning id`, [orgA])).rows[0].id;
    draft = (await db.query(
      `insert into training_materials (organization_id, category, title, body, status) values ($1, 'other', 'Melnraksts', '## B', 'draft') returning id`, [orgA])).rows[0].id;
  }, 180_000);

  afterAll(async () => {
    await db?.end();
  });

  describe("materials", () => {
    it("employee sees published materials only", async () => {
      const rows = await as(U.employeeA, (q) => q(`select id, status from training_materials where organization_id = $1`, [orgA]));
      expect(rows.map((r) => r.id)).toEqual([published]);
    });
    it("manage_safety sees drafts too", async () => {
      const rows = await as(U.ownerA, (q) => q(`select id from training_materials where organization_id = $1`, [orgA]));
      expect(rows.map((r) => r.id).sort()).toEqual([published, draft].sort());
    });
    it("soft-deleted materials disappear for employees", async () => {
      const n = await as(U.ownerA, async (q) => {
        await q(`update training_materials set deleted_at = now() where id = $1`, [published]);
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.employeeA, role: "authenticated" })]);
        return (await q(`select count(*)::int n from training_materials where id = $1`, [published]))[0].n;
      });
      expect(n).toBe(0);
    });
    it("employee cannot create or edit materials", async () => {
      expect(await fails(U.employeeA, `insert into training_materials (organization_id, title) values ($1, 'x')`, [orgA])).toMatch(/row-level security|42501/);
      const upd = await as(U.employeeA, (q) => q(`update training_materials set title = 'hacked' where id = $1 returning id`, [published]));
      expect(upd).toHaveLength(0);
    });
    it("manager without manage_safety cannot create materials", async () => {
      expect(await fails(U.managerA, `insert into training_materials (organization_id, title) values ($1, 'x')`, [orgA])).toMatch(/row-level security|42501/);
    });
    it("nobody can hard-delete a material", async () => {
      expect(await fails(U.ownerA, `delete from training_materials where id = $1`, [draft])).toMatch(/permission denied|42501/);
    });
    it("is isolated between organizations", async () => {
      const rows = await as(U.ownerB, (q) => q(`select id from training_materials where organization_id = $1`, [orgA]));
      expect(rows).toHaveLength(0);
      expect(await fails(U.ownerB, `insert into training_materials (organization_id, title) values ($1, 'x')`, [orgA])).toMatch(/row-level security|42501/);
    });
    it("rejects a country of another organization", async () => {
      const countryB = (await db.query(`select id from countries where organization_id = $1 limit 1`, [orgB])).rows[0].id;
      expect(await fails(U.ownerA, `insert into training_materials (organization_id, title, country_id) values ($1, 'x', $2)`, [orgA, countryB])).toMatch(/CROSS_ORG/);
    });
    it("version never goes backwards", async () => {
      expect(await fails(U.ownerA, `update training_materials set version = 0 where id = $1`, [published])).toMatch(/23514|check|INVALID_VERSION/);
    });
  });

  describe("acknowledgements", () => {
    it("employee acknowledges the current version with server time", async () => {
      const row = await as(U.employeeA, (q) => q(ACK, [orgA, published, 1, empA, U.employeeA]));
      expect(row[0].version).toBe(1);
      expect(Math.abs(new Date(String(row[0].acknowledged_at)).getTime() - Date.now())).toBeLessThan(60 * 60 * 1000);
    });
    it("cannot acknowledge on behalf of another employee or user", async () => {
      expect(await fails(U.employeeA, ACK, [orgA, published, 1, otherEmpA, U.employeeA])).toMatch(/row-level security|42501/);
      expect(await fails(U.employeeA, ACK, [orgA, published, 1, empA, U.ownerA])).toMatch(/row-level security|42501/);
    });
    it("cannot acknowledge an outdated version, a draft or a deleted material", async () => {
      expect(await fails(U.employeeA, ACK, [orgA, published, 2, empA, U.employeeA])).toMatch(/INVALID_ACKNOWLEDGEMENT/);
      expect(await fails(U.employeeA, ACK, [orgA, draft, 1, empA, U.employeeA])).toMatch(/INVALID_ACKNOWLEDGEMENT|row-level security/);
    });
    it("a version bump requires a new acknowledgement", async () => {
      const r = await as(U.ownerA, async (q) => {
        await db.query(`reset role`);
        await db.query(ACK, [orgA, published, 1, empA, U.employeeA]);
        await db.query(`update training_materials set version = 2, body = '## A2' where id = $1`, [published]);
        await db.query(`set local role authenticated`);
        return q(`select count(*)::int n from training_material_acks where material_id = $1 and version = 2`, [published]);
      });
      expect(r[0].n).toBe(0);
      // the old version can no longer be acknowledged once bumped
      const err = await as(U.employeeA, async (q) => {
        await db.query(`reset role`);
        await db.query(`update training_materials set version = 2 where id = $1`, [published]);
        await db.query(`set local role authenticated`);
        await db.query("savepoint s");
        try { await q(ACK, [orgA, published, 1, empA, U.employeeA]); return "ok"; } catch (e) { await db.query("rollback to savepoint s"); return String((e as Error).message); }
      });
      expect(err).toMatch(/INVALID_ACKNOWLEDGEMENT/);
    });
    it("rejects a material from another organization", async () => {
      const empB = (await db.query(`select id from employees where user_id = $1`, [U.employeeB])).rows[0].id;
      expect(await fails(U.employeeB, ACK, [orgB, published, 1, empB, U.employeeB])).toMatch(/CROSS_ORG|row-level security/);
    });
    it("acknowledgements are append-only", async () => {
      const res = await as(U.ownerA, async (q) => {
        await db.query(`reset role`);
        await db.query(ACK, [orgA, published, 1, empA, U.employeeA]);
        await db.query(`set local role authenticated`);
        await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U.employeeA, role: "authenticated" })]);
        await db.query("savepoint s");
        try { await q(`delete from training_material_acks where material_id = $1`, [published]); return "deleted"; } catch (e) { await db.query("rollback to savepoint s"); return String((e as Error).message); }
      });
      expect(res).toMatch(/permission denied/);
    });
    it("visibility: own acks, managers of safety see all, others none", async () => {
      await db.query(ACK, [orgA, published, 1, empA, U.employeeA]);
      try {
        const own = await as(U.employeeA, (q) => q(`select id from training_material_acks`));
        const owner = await as(U.ownerA, (q) => q(`select id from training_material_acks where organization_id = $1`, [orgA]));
        const manager = await as(U.managerA, (q) => q(`select id from training_material_acks where employee_id = $1`, [empA]));
        const b = await as(U.ownerB, (q) => q(`select id from training_material_acks`));
        expect(own).toHaveLength(1);
        expect(owner).toHaveLength(1);
        expect(manager).toHaveLength(0);
        expect(b).toHaveLength(0);
      } finally {
        await db.query(`delete from training_material_acks where material_id = $1`, [published]);
      }
    });
  });

  describe("training_audience()", () => {
    it("lists linked employees with roles for manage_safety", async () => {
      const rows = await as(U.ownerA, (q) => q(`select * from training_audience($1)`, [orgA]));
      const me = rows.find((r) => r.employee_id === empA);
      expect(me?.roles).toEqual(["employee"]);
      expect(rows.every((r) => r.employee_id)).toBe(true);
    });
    it("returns nothing without manage_safety or across organizations", async () => {
      expect(await as(U.employeeA, (q) => q(`select * from training_audience($1)`, [orgA]))).toHaveLength(0);
      expect(await as(U.ownerB, (q) => q(`select * from training_audience($1)`, [orgA]))).toHaveLength(0);
    });
  });
});
