#!/usr/bin/env python3
"""
Generates src/lib/database.types.ts from a live PostgreSQL schema (same shape as
`supabase gen types typescript`). Normally run:

    npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

This script exists for environments without the Supabase CLI/Docker:

    DATABASE_URL=postgres://... python3 scripts/gen-db-types.py
"""
import json, os, subprocess, sys

DB = os.environ.get("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/mjfg_test")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "database.types.ts")

def q(sql):
    r = subprocess.run(["psql", DB, "-At", "-c", sql], capture_output=True, text=True, check=True)
    return json.loads(r.stdout.strip() or "null")

TS = {
    "uuid": "string", "text": "string", "character varying": "string", "character": "string", "citext": "string",
    "integer": "number", "bigint": "number", "smallint": "number", "numeric": "number", "double precision": "number", "real": "number",
    "boolean": "boolean", "jsonb": "Json", "json": "Json",
    "timestamp with time zone": "string", "timestamp without time zone": "string", "date": "string", "time without time zone": "string",
    "interval": "string", "inet": "string", "bytea": "string",
}

def ts_type(data_type, udt):
    if data_type == "ARRAY":
        base = udt.lstrip("_")
        m = {"text": "string", "uuid": "string", "int4": "number", "int8": "number", "numeric": "number", "varchar": "string"}
        return f"{m.get(base, 'unknown')}[]"
    return TS.get(data_type, "unknown")

cols = q("""
select json_agg(json_build_object('t', c.table_name, 'c', c.column_name, 'dt', c.data_type, 'udt', c.udt_name,
  'nullable', c.is_nullable = 'YES', 'default', c.column_default is not null, 'identity', c.is_identity = 'YES',
  'generated', c.is_generated = 'ALWAYS', 'pos', c.ordinal_position) order by c.table_name, c.ordinal_position)
from information_schema.columns c where c.table_schema = 'public'
""")
kinds = q("""select json_object_agg(c.relname, c.relkind) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v')""")
fks = q("""
select coalesce(json_agg(json_build_object('t', tc.relname, 'name', con.conname,
  'cols', (select json_agg(a.attname order by k.i) from unnest(con.conkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n),
  'ref', rc.relname,
  'refcols', (select json_agg(a.attname order by k.i) from unnest(con.confkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n),
  'one', exists (select 1 from pg_index ix where ix.indrelid = con.conrelid and ix.indisunique and ix.indpred is null and ix.indkey::int2[] @> con.conkey and array_length(ix.indkey::int2[],1) = array_length(con.conkey,1))
) order by tc.relname, con.conname), '[]'::json)
from pg_constraint con join pg_class tc on tc.oid = con.conrelid join pg_namespace n on n.oid = tc.relnamespace
join pg_class rc on rc.oid = con.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
""")
funcs = q("""
select coalesce(json_agg(json_build_object('name', p.proname, 'args', pg_get_function_arguments(p.oid),
  'ret', pg_get_function_result(p.oid), 'retset', p.proretset,
  'argnames', p.proargnames, 'argmodes', p.proargmodes, 'types',
  (select json_agg(format_type(t, null) order by i) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality x(t, i)),
  'nargs', p.pronargs, 'ndefaults', p.pronargdefaults) order by p.proname), '[]'::json)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and pg_get_function_result(p.oid) <> 'trigger'
""")

FMT = {"uuid": "string", "text": "string", "integer": "number", "bigint": "number", "numeric": "number", "boolean": "boolean",
       "jsonb": "Json", "json": "Json", "date": "string", "timestamp with time zone": "string", "text[]": "string[]",
       "double precision": "number", "void": "undefined", "character varying": "string"}

tables = {}
for c in cols:
    tables.setdefault(c["t"], []).append(c)

def rels_for(t):
    out = []
    for f in fks:
        if f["t"] == t:
            out.append(f"""          {{
            foreignKeyName: "{f['name']}"
            columns: {json.dumps(f['cols'])}
            isOneToOne: {'true' if f['one'] else 'false'}
            referencedRelation: "{f['ref']}"
            referencedColumns: {json.dumps(f['refcols'])}
          }}""")
    return "[\n" + ",\n".join(out) + "\n        ]" if out else "[]"

lines = ["export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]", "",
         "export type Database = {", "  public: {", "    Tables: {"]
views = []
for t in sorted(tables):
    kind = kinds.get(t)
    if kind == "v":
        views.append(t); continue
    cs = tables[t]
    row = "\n".join(f"          {c['c']}: {ts_type(c['dt'], c['udt'])}{' | null' if c['nullable'] else ''}" for c in cs)
    ins = []
    upd = []
    for c in cs:
        ty = ts_type(c['dt'], c['udt']) + (" | null" if c['nullable'] else "")
        if c["generated"]:
            ins.append(f"          {c['c']}?: never"); upd.append(f"          {c['c']}?: never"); continue
        opt = c["nullable"] or c["default"] or c["identity"]
        ins.append(f"          {c['c']}{'?' if opt else ''}: {ty}")
        upd.append(f"          {c['c']}?: {ty}")
    lines.append(f"      {t}: {{\n        Row: {{\n{row}\n        }}\n        Insert: {{\n" + "\n".join(ins) + "\n        }\n        Update: {\n" + "\n".join(upd) + f"\n        }}\n        Relationships: {rels_for(t)}\n      }}")
lines.append("    }")
lines.append("    Views: {")
for v in views:
    row = "\n".join(f"          {c['c']}: {ts_type(c['dt'], c['udt'])} | null" for c in tables[v])
    lines.append(f"      {v}: {{\n        Row: {{\n{row}\n        }}\n        Relationships: []\n      }}")
lines.append("    }")
lines.append("    Functions: {")

def parse_args(f):
    names = f["argnames"] or []
    modes = f["argmodes"] or ["i"] * len(f["types"] or [])
    types = f["types"] or []
    args, outs = [], []
    n_in = sum(1 for m in modes if m in ("i", "b", "v"))
    nd = f["ndefaults"]
    idx_in = 0
    for i, ty in enumerate(types):
        m = modes[i] if i < len(modes) else "i"
        name = names[i] if i < len(names) else f"arg{i}"
        if m in ("i", "b", "v"):
            optional = idx_in >= n_in - nd
            args.append(f"{name}{'?' if optional else ''}: {FMT.get(ty, 'unknown')}")
            idx_in += 1
        if m in ("o", "t", "b"):
            outs.append(f"{name}: {FMT.get(ty, 'unknown')}")
    return args, outs

for f in funcs:
    args, outs = parse_args(f)
    if outs:
        ret = "{\n" + "\n".join(f"            {o}" for o in outs) + "\n          }[]"
    else:
        r = f["ret"]
        base = r.replace("SETOF ", "")
        ret = FMT.get(base, "unknown") + ("[]" if f["retset"] else "")
    a = "Record<PropertyKey, never>" if not args else "{\n" + "\n".join(f"            {x}" for x in args) + "\n          }"
    lines.append(f"      {f['name']}: {{\n        Args: {a}\n        Returns: {ret}\n      }}")
lines += ["    }", "    Enums: {", "      [_ in never]: never", "    }", "    CompositeTypes: {", "      [_ in never]: never", "    }", "  }", "}", ""]
lines.append('export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]')
lines.append('export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]')
lines.append('export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]')
lines.append('export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"]')
lines.append("")
open(OUT, "w").write("// Generated by scripts/gen-db-types.py — do not edit by hand.\n" + "\n".join(lines))
print("wrote", OUT, len(tables), "relations,", len(funcs), "functions")
