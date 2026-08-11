#!/usr/bin/env bash
# Supplementary manual backup — NOT a replacement for Supabase's own
# Point-in-Time Recovery (a dashboard/plan setting under Database → Backups),
# which is the real production safety net. This script is for on-demand
# snapshots (e.g. immediately before a schema change) and for the rollback
# rehearsal drill (.github/workflows/db-restore-drill.yml).
#
# Requires: the Supabase CLI, and DATABASE_URL pointed at the target project
# (Project Settings → Database → Connection string — use the pooler URI).
#
# Usage: DATABASE_URL=postgres://... ./scripts/backup-db.sh [output-dir]

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/somnara-backup-$TIMESTAMP.sql"

echo "Backing up to $OUT_FILE ..."
if command -v supabase >/dev/null 2>&1; then
  supabase db dump --db-url "$DATABASE_URL" -f "$OUT_FILE"
else
  echo "Supabase CLI not found, falling back to pg_dump." >&2
  pg_dump "$DATABASE_URL" --no-owner --no-privileges -f "$OUT_FILE"
fi

echo "Done: $OUT_FILE"
