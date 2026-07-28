#!/bin/sh

set -eu

backup_file="${RESTORE_FILE:-}"

if [ "${CONFIRM_RESTORE:-}" != "RESTORE_NEXTCRM" ]; then
    echo "[restore] Set CONFIRM_RESTORE=RESTORE_NEXTCRM untuk mengonfirmasi." >&2
    exit 1
fi

if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
    echo "[restore] RESTORE_FILE harus menunjuk ke berkas .dump di /backups." >&2
    exit 1
fi

if [ -f "${backup_file}.sha256" ]; then
    sha256sum -c "${backup_file}.sha256"
fi

echo "[restore] Memulihkan $backup_file ke ${PGDATABASE}@${PGHOST}."

pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --exit-on-error \
    --dbname="$PGDATABASE" \
    "$backup_file"

echo "[restore] Pemulihan selesai."
