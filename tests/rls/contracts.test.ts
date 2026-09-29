/**
 * RLS & integrity tests for the contracts register and the public tender cache
 * (public.contracts, public.contract_milestones, public.tender_notices).
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
  employeeA: "00000000-0000-0000-0000-00000000000e",
  ownerB: "00000000-0000-0000-0000-0000000000b1",
};

type Row = Record<string, unknown>;
type Q = (sql: string, params?: unknown[]) => Promise<Row[]>;

let db: Client;
let orgA: string;
let orgB: string;
let contractA: string;

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

describe.skipIf(!DB)("contracts & tenders RLS", () => {
  beforeAll(async () => {
    execSync(`${ROOT}/scripts/db-test-setup.sh`, { env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -q -f ${ROOT}/tests/db/fixtures.sql`, { stdio: "pipe" });
    db = new Client({ connectionString: DB });
    await db.connect();
    orgA = (await db.query(`select id from organizations where slug = 'org-a'`)).rows[0].id;
    orgB = (await db.query(`select id from organizations where slug = 'org-b'`)).rows[0].id;
    contractA = (await db.query(
      `insert into contracts (organization_id, title, status, total_value, volume_m3) values ($1, 'Kailcirte Ogre', 'active', 42000, 3500) returning id`, [orgA])).rows[0].id;
    await db.query(`insert into tender_notices (id, source, country, stage, title, category, score) values ('iub:t1', 'iub', 'LV', 'competition', 'Mežizstrādes pakalpojumi', 'harvesting', 5)`);
  }, 180_000);

  afterAll(async () => {
    await db?.end();
  });

  it("owner sees and edits contracts", async () => {
    const rows = await as(U.ownerA, (q) => q(`select id from contracts where organization_id = $1`, [orgA]));
    expect(rows.map((r) => r.id)).toEqual([contractA]);
    const upd = await as(U.ownerA, (q) => q(`update contracts set status = 'completed' where id = $1 returning id`, [contractA]));
    expect(upd).toHaveLength(1);
  });

  it("ordinary employee cannot see or create contracts", async () => {
    const rows = await as(U.employeeA, (q) => q(`select id from contracts where organization_id = $1`, [orgA]));
    expect(rows).toHaveLength(0);
    expect(await fails(U.employeeA, `insert into contracts (organization_id, title) values ($1, 'x')`, [orgA])).toMatch(/row-level security|42501/);
  });

  it("is isolated between organizations", async () => {
    const rows = await as(U.ownerB, (q) => q(`select id from contracts where organization_id = $1`, [orgA]));
    expect(rows).toHaveLength(0);
    expect(await fails(U.ownerB, `insert into contracts (organization_id, title) values ($1, 'x')`, [orgA])).toMatch(/row-level security|42501/);
  });

  it("rejects references to another organization", async () => {
    const countryB = (await db.query(`select id from countries where organization_id = $1 limit 1`, [orgB])).rows[0].id;
    expect(await fails(U.ownerA, `insert into contracts (organization_id, title, country_id) values ($1, 'x', $2)`, [orgA, countryB])).toMatch(/CROSS_ORG/);
    const contractB = (await db.query(`insert into contracts (organization_id, title) values ($1, 'B') returning id`, [orgB])).rows[0].id;
    expect(await fails(U.ownerA, `insert into contract_milestones (organization_id, contract_id, title) values ($1, $2, 'x')`, [orgA, contractB])).toMatch(/CROSS_ORG/);
  });

  it("milestones follow the contract permissions", async () => {
    const m = await as(U.ownerA, (q) => q(`insert into contract_milestones (organization_id, contract_id, kind, title, due_date, amount) values ($1, $2, 'invoice', 'Rēķins #1', current_date, 12000) returning id`, [orgA, contractA]));
    expect(m).toHaveLength(1);
    expect(await fails(U.employeeA, `insert into contract_milestones (organization_id, contract_id, title) values ($1, $2, 'x')`, [orgA, contractA])).toMatch(/row-level security|42501/);
  });

  it("nobody can hard-delete contracts", async () => {
    expect(await fails(U.ownerA, `delete from contracts where id = $1`, [contractA])).toMatch(/permission denied|42501/);
  });

  it("rejects an end date before the start date", async () => {
    expect(await fails(U.ownerA, `insert into contracts (organization_id, title, start_date, end_date) values ($1, 'x', '2026-10-10', '2026-10-01')`, [orgA])).toMatch(/contracts_period|23514/);
  });

  it("contract documents are allowed in files", async () => {
    const f = await as(U.ownerA, (q) => q(
      `insert into files (organization_id, bucket, path, entity_type, entity_id, kind, uploaded_by) values ($1::uuid, 'documents', $1::text || '/contract/' || $2::text || '/a.pdf', 'contract', $2::uuid, 'document', $3) returning id`,
      [orgA, contractA, U.ownerA]));
    expect(f).toHaveLength(1);
  });

  it("tender cache is readable but not writable by users", async () => {
    const rows = await as(U.employeeA, (q) => q(`select id from tender_notices`));
    expect(rows.map((r) => r.id)).toContain("iub:t1");
    expect(await fails(U.ownerA, `insert into tender_notices (id, source, country, stage, title) values ('iub:x', 'iub', 'LV', 'competition', 'x')`)).toMatch(/permission denied|42501/);
    expect(await fails(U.ownerA, `update tender_notices set title = 'x' where id = 'iub:t1'`)).toMatch(/permission denied|42501/);
  });
});
