#!/usr/bin/env bash
# Recreates a throw-away PostgreSQL database, applies the Supabase shim (only for
# plain Postgres) and every migration in order. Used by `npm run test:db`.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/mjfg_test ./scripts/db-test-setup.sh
#
# Against a Supabase local stack use `supabase db reset` instead (it has auth/storage).
set -euo pipefail
DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/mjfg_test}"
ADMIN_URL="${DB_URL%/*}/postgres"
DB_NAME="${DB_URL##*/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists \"$DB_NAME\" with (force);" -c "create database \"$DB_NAME\";"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/db/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "✓ migrations applied to $DB_NAME"
