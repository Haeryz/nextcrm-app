#!/bin/sh

set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"

case "$interval" in
    *[!0-9]*|"") echo "[backup] BACKUP_INTERVAL_SECONDS harus berupa angka." >&2; exit 1 ;;
esac

trap 'exit 0' TERM INT

while true; do
    if ! /usr/local/bin/backup-now; then
        echo "[backup] Backup gagal; percobaan berikutnya tetap dijadwalkan." >&2
    fi
    sleep "$interval" &
    wait $!
done
