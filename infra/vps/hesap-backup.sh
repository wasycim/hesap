#!/usr/bin/env bash
set -euo pipefail

source /etc/hesap/backup.env
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION
host="${BACKUP_NODE_NAME:-vps}"

umask 077
mkdir -p /var/lib/hesap/backups /var/log/hesap
if getent group postgres >/dev/null; then
  chgrp postgres /var/lib/hesap/backups
  chmod 750 /var/lib/hesap/backups
else
  chmod 700 /var/lib/hesap/backups
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="hesap-postgres-${stamp}.dump"
dump="/var/lib/hesap/backups/${file}"
status_file="/var/lib/hesap/last-backup.json"
log_file="/var/log/hesap/backup.log"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

{
  echo "[$started] backup started"

  pg_dump \
    --dbname="$PRIMARY_DATABASE_URL" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    --file="$dump"

  if getent group postgres >/dev/null; then
    chgrp postgres "$dump"
    chmod 640 "$dump"
  else
    chmod 600 "$dump"
  fi

  sha=$(sha256sum "$dump" | awk '{print $1}')
  size=$(stat -c%s "$dump")

  aws --endpoint-url "$R2_ENDPOINT" \
    s3 cp "$dump" "s3://${R2_BUCKET_NAME}/postgres/${host}/${file}" \
    --only-show-errors

  if [ "${BACKUP_RESTORE_STANDBY:-1}" = "1" ]; then
    runuser -u postgres -- psql -d postgres -v ON_ERROR_STOP=1 </usr/local/share/hesap-standby-prelude.sql
    runuser -u postgres -- pg_restore \
      --schema=public \
      --clean \
      --if-exists \
      --no-owner \
      --role=hesap_app \
      --dbname=hesap_failover \
      "$dump"

    runuser -u postgres -- psql -d hesap_failover -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO hesap_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hesap_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hesap_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hesap_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hesap_app;
SQL
  fi

  completed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  jq -n \
    --arg ok "true" \
    --arg started "$started" \
    --arg completed "$completed" \
    --arg file "$file" \
    --arg sha256 "$sha" \
    --argjson size "$size" \
    --arg bucket "$R2_BUCKET_NAME" \
    --arg standby "${BACKUP_RESTORE_STANDBY:-1}" \
    '{ok:($ok=="true"), startedAt:$started, completedAt:$completed, file:$file, size:$size, sha256:$sha256, bucket:$bucket, standbyRestore:($standby=="1")}' \
    > "$status_file"

  psql "$PRIMARY_DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -v file="$file" \
    -v sha="$sha" \
    -v size="$size" \
    -v bucket="$R2_BUCKET_NAME" \
    -v started="$started" \
    -v completed="$completed" \
    -v host="$host" <<'SQL' || true
insert into public.security_events (event_type, details)
values (
  'vps_backup_completed',
  jsonb_build_object(
    'file', :'file',
    'sha256', :'sha',
    'size', (:size)::bigint,
    'bucket', :'bucket',
    'startedAt', :'started',
    'completedAt', :'completed',
    'scope', 'full_postgresql_dump',
    'includes', jsonb_build_array('gelir_kayitlari', 'gider_kayitlari', 'corbalar', 'attendance_logs'),
    'host', :'host'
  )
);
SQL

  find /var/lib/hesap/backups -name 'hesap-postgres-*.dump' -type f -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
  echo "[$completed] backup completed file=${file} size=${size} sha256=${sha}"
} >> "$log_file" 2>&1
