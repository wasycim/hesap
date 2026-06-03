#!/usr/bin/env bash
set -euo pipefail

source /etc/hesap/backup.env
source /etc/hesap/server.env
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION

pg_status="down"
PGPASSWORD="$FAILOVER_DB_PASSWORD" pg_isready -h 127.0.0.1 -p 5432 -d hesap_failover -U hesap_app >/dev/null 2>&1 && pg_status="operational"

r2_status="down"
aws --endpoint-url "$R2_ENDPOINT" s3 ls "s3://${R2_BUCKET_NAME}/" >/dev/null 2>&1 && r2_status="operational"

last_backup=null
if [ -f /var/lib/hesap/last-backup.json ]; then
  last_backup=$(cat /var/lib/hesap/last-backup.json)
fi

jq -n \
  --arg checkedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg postgres "$pg_status" \
  --arg r2 "$r2_status" \
  --argjson lastBackup "$last_backup" \
  '{checkedAt:$checkedAt, postgres:$postgres, r2:$r2, lastBackup:$lastBackup}'
