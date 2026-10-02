#!/bin/sh
# Daily PostgreSQL backup + retention. Runs inside the `backup` service (crond).
set -e

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${POSTGRES_HOST:=postgres}" "${BACKUP_KEEP:=7}"

stamp="$(date +%Y-%m-%d_%H%M)"
file="/backups/shahrjo_${stamp}.sql.gz"

pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$file"
echo "$(date '+%F %T') wrote $file ($(du -h "$file" | cut -f1))"

# keep only the newest $BACKUP_KEEP backups
ls -1t /backups/shahrjo_*.sql.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -f
