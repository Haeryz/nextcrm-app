#!/bin/sh

set -eu

endpoint="${1:-}"
base_url="${APP_INTERNAL_URL:-http://appbuild:3000}"

if [ -z "$endpoint" ] || [ -z "${CRON_SECRET:-}" ]; then
    echo "[scheduler] Endpoint atau CRON_SECRET belum dikonfigurasi." >&2
    exit 1
fi

case "$endpoint" in
    /api/cron/mektek-weekly-reminders|\
    /api/cron/mektek-finance-reminders|\
    /api/cron/mektek-marketing-send|\
    /api/cron/mektek-offers-send)
        ;;
    *)
        echo "[scheduler] Endpoint tidak diizinkan: $endpoint" >&2
        exit 1
        ;;
esac

echo "[scheduler] Menjalankan $endpoint pada $(date -u +%FT%TZ)"

curl \
    --fail \
    --silent \
    --show-error \
    --retry 2 \
    --retry-delay 5 \
    --connect-timeout 10 \
    --max-time 900 \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    "${base_url}${endpoint}"

echo
echo "[scheduler] Selesai menjalankan $endpoint"
