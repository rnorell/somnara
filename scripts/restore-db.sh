#!/usr/bin/env bash
# Restores a dump produced by scripts/backup-db.sh. Destructive — this
# overwrites the target database's contents. Requires explicit confirmation
# unless CONFIRM=1 is set (used by the CI drill workflow, which always
# targets a staging project, never production).
#
# Usage: DATABASE_URL=postgres://... ./scripts/restore-db.sh path/to/dump.sql

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

DUMP_FILE="${1:-}"
if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Error: pass the path to a dump file produced by backup-db.sh." >&2
  exit 1
fi

if [ "${CONFIRM:-}" != "1" ]; then
  echo "This will OVERWRITE the database at DATABASE_URL with the contents of $DUMP_FILE."
  read -r -p "Type 'restore' to continue: " confirmation
  if [ "$confirmation" != "restore" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring $DUMP_FILE ..."
psql "$DATABASE_URL" -f "$DUMP_FILE"
echo "Restore complete."
