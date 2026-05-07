#!/usr/bin/env bash
# Re-apply seed-test-data.sql against the local DB.
# Idempotent — relies on ON CONFLICT DO NOTHING in the seed file.

set -euo pipefail

PROJECT_ID="$(grep -E '^project_id' supabase/config.toml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
DB_CONTAINER="supabase_db_${PROJECT_ID}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SEED_FILE="supabase/seed-test-data.sql"

if command -v psql &>/dev/null && psql "$DB_URL" -c 'SELECT 1' &>/dev/null; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE"
elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SEED_FILE"
else
  echo "ERROR: cannot reach local DB. Run 'npm run supabase:start' first." >&2
  exit 1
fi

echo "✓ Seed applied."
