#!/bin/sh

set -eu

if [ -z "${CRON_SECRET:-}" ]; then
    echo "[scheduler] CRON_SECRET wajib diisi." >&2
    exit 1
fi

echo "[scheduler] Scheduler aktif menggunakan zona waktu ${TZ:-UTC}."
exec crond -f -l 2
