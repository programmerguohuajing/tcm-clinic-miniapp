#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-tcm_clinic}"
POSTGRES_USER="${POSTGRES_USER:-tcm_app}"
KEEP_DAYS="${KEEP_DAYS:-7}"

timestamp="$(date +%Y%m%d_%H%M%S)"
target="${BACKUP_DIR}/${POSTGRES_DB}_${timestamp}.sql.gz"

mkdir -p "$BACKUP_DIR"
PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  "$POSTGRES_DB" | gzip > "$target"

find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete

echo "backup created: $target"
