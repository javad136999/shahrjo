#!/bin/sh
# Daily PostgreSQL backup + retention. Runs inside the `backup` service (crond).
set -e

: "${POSTGRES_USER:?}" "${POSTGRES_PASSWORD:?}" "${POSTGRES_DB:?}" "${POSTGRES_HOST:=postgres}" "${BACKUP_KEEP:=7}"

# libpq reads PGPASSWORD, not POSTGRES_PASSWORD.
export PGPASSWORD="$POSTGRES_PASSWORD"

stamp="$(date +%Y-%m-%d_%H%M)"
file="/backups/shahrjo_${stamp}.sql.gz"

# Dump first (set -e aborts on failure), then compress: a failed pg_dump in a
# pipeline would otherwise leave a silent 0-byte "backup".
tmp="/backups/.${stamp}.dump"
trap 'rm -f "$tmp"' EXIT
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner > "$tmp"
gzip -c "$tmp" > "$file"
echo "$(date '+%F %T') wrote $file ($(du -h "$file" | cut -f1))"

# keep only the newest $BACKUP_KEEP backups
ls -1t /backups/shahrjo_*.sql.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -f
