#!/usr/bin/env bash
# Initialise the local Supabase Postgres with schema + migrations + seed.
#
# Usage:
#   bash scripts/db-init.sh           # Apply schema, migrations, seed (idempotent)
#   bash scripts/db-init.sh --drop    # Drop public schema first (full reset)
#
# Requires `npm run supabase:start` to already be running.
# Uses host `psql` if available, otherwise falls back to `docker exec` against
# the supabase_db_<project> container so users don't need Postgres tools locally.

set -euo pipefail

PROJECT_ID="$(grep -E '^project_id' supabase/config.toml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
DB_CONTAINER="supabase_db_${PROJECT_ID}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SCHEMA_FILE="supabase/schema.sql"
MIGRATIONS_DIR="supabase/migrations"
SEED_FILE="supabase/seed-test-data.sql"

# Pick runner: prefer host psql, fall back to docker exec.
if command -v psql &>/dev/null && psql "$DB_URL" -c 'SELECT 1' &>/dev/null; then
  RUNNER="host"
elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  RUNNER="docker"
else
  echo "ERROR: cannot reach local DB." >&2
  echo "  Run 'npm run supabase:start' first, or install psql." >&2
  exit 1
fi

run_sql_file() {
  local file=$1
  if [ "$RUNNER" = "host" ]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  else
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
  fi
}

run_sql() {
  local sql=$1
  if [ "$RUNNER" = "host" ]; then
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$sql"
  else
    docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

echo "Runner: $RUNNER"

if [ "${1:-}" = "--drop" ]; then
  echo "Dropping public schema and re-granting Supabase default privileges..."
  # CASCADE removes Supabase's default GRANTs along with the tables. Re-grant
  # USAGE + ALL on tables/functions/sequences to the standard Supabase roles
  # so PostgREST (anon, service_role) can reach the schema again.
  run_sql "DROP SCHEMA IF EXISTS public CASCADE;
           CREATE SCHEMA public;
           GRANT ALL ON SCHEMA public TO postgres;
           GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
           ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
           ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
           ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;"
fi

echo "Applying schema: $SCHEMA_FILE"
run_sql_file "$SCHEMA_FILE"

echo "Applying migrations in order..."
for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "  → $(basename "$migration")"
  run_sql_file "$migration"
done

echo "Seeding test data: $SEED_FILE"
run_sql_file "$SEED_FILE"

echo ""
echo "✓ Local DB ready."
echo "  API:  http://127.0.0.1:54321"
echo "  DB:   $DB_URL"
echo "  Mail: http://127.0.0.1:54324 (mailpit catches auth emails)"
