#!/bin/sh

set -eu

backup_dir="${BACKUP_DIR:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

require_value() {
    name="$1"
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        echo "[backup] $name wajib diisi." >&2
        exit 1
    fi
}

require_value PGHOST
require_value PGUSER
require_value PGDATABASE
require_value PGPASSWORD

case "$retention_days" in
    *[!0-9]*|"") echo "[backup] BACKUP_RETENTION_DAYS harus berupa angka." >&2; exit 1 ;;
esac

mkdir -p "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final_path="${backup_dir}/nextcrm-${timestamp}.dump"
temp_path="${final_path}.partial"

echo "[backup] Memulai backup PostgreSQL ${timestamp}."

rm -f "$temp_path"
pg_dump \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    --file="$temp_path"

mv "$temp_path" "$final_path"
sha256sum "$final_path" > "${final_path}.sha256"

find "$backup_dir" -type f \
    \( -name 'nextcrm-*.dump' -o -name 'nextcrm-*.dump.sha256' \) \
    -mtime "+${retention_days}" -delete

echo "[backup] Backup lokal selesai: $final_path"

if [ -n "${RESTIC_REPOSITORY:-}" ] && [ -n "${RESTIC_PASSWORD:-}" ]; then
    if ! restic snapshots >/dev/null 2>&1; then
        echo "[backup] Repository Restic belum siap; mencoba inisialisasi."
        restic init
    fi

    restic backup "$final_path" "${final_path}.sha256"
    restic forget \
        --keep-daily 7 \
        --keep-weekly 5 \
        --keep-monthly 12 \
        --prune
    echo "[backup] Salinan off-site Restic selesai."
else
    echo "[backup] PERINGATAN: backup off-site belum dikonfigurasi."
fi
