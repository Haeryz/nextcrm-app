#!/usr/bin/env bash
#
# mac-pull-backups.sh — pull NextCRM database backups from the VPS to this Mac.
#
# Runs on the MacBook. Connects to the VPS over SSH and rsyncs the newest
# PostgreSQL dump files (nextcrm-*.dump + nextcrm-*.dump.sha256) from the
# Docker volume `nextcrm_postgres_backups` into a local folder. Verifies the
# SHA-256 of every file it pulls and prunes local copies older than the
# configured retention.
#
# Designed for an unattended launchd job, so it needs SSH key auth to the VPS
# (see docs/deployment-production-self-hosted.md §14). All settings are
# overridable via environment variables.
#
# Defaults:
#   SSH_HOST=mektek-vps              (alias di ~/.ssh/config; lihat README)
#   VPS_VOLUME_PATH=/var/lib/docker/volumes/nextcrm_postgres_backups/_data
#   LOCAL_BACKUP_DIR=~/nextcrm-backups
#   RETENTION_DAYS=14
#
# Bila SSH_HOST kosong, fallback ke VPS_USER@VPS_HOST:SSH_PORT (tanpa config).
#
# Usage:
#   ./scripts/mac-pull-backups.sh
#   SSH_HOST=mektek-vps LOCAL_BACKUP_DIR=/Volumes/External/nextcrm-backups \
#     ./scripts/mac-pull-backups.sh

set -Eeuo pipefail

SSH_HOST="${SSH_HOST:-mektek-vps}"
VPS_HOST="${VPS_HOST:-116.212.73.225}"
VPS_USER="${VPS_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
VPS_VOLUME_PATH="${VPS_VOLUME_PATH:-/var/lib/docker/volumes/nextcrm_postgres_backups/_data}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$HOME/nextcrm-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
LOG_FILE="${LOG_FILE:-$HOME/nextcrm-backups/pull.log}"

mkdir -p "$LOCAL_BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    printf '[%s] [mac-pull] %s\n' "$(date -Is)" "$*" | tee -a "$LOG_FILE" >&2
}

# SSH target: gunakan alias config bila ada, fallback ke user@host:port.
if [ -n "$SSH_HOST" ]; then
    SSH_TARGET="$SSH_HOST"
    SSH_OPTS=(-o ConnectTimeout=10)
    RSYNC_SSH="ssh -o ConnectTimeout=10"
else
    SSH_TARGET="${VPS_USER}@${VPS_HOST}"
    SSH_OPTS=(-p "$SSH_PORT" -o ConnectTimeout=10)
    RSYNC_SSH="ssh -p ${SSH_PORT} -o ConnectTimeout=10"
fi

log "target=${SSH_TARGET} volume=${VPS_VOLUME_PATH} dest=${LOCAL_BACKUP_DIR}"

# Sanity: can we reach the VPS and see the volume directory?
if ! ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
        "test -d '${VPS_VOLUME_PATH}'" 2>>"$LOG_FILE"; then
    log "GAGAL: tidak dapat menjangkau ${VPS_VOLUME_PATH} di VPS."
    log "Periksa SSH key auth, host, dan jalur volume. Bukan masalah jika backup"
    log "belum pernah jalan (folder baru dibuat setelah backup pertama)."
    exit 1
fi

# rsync only newer/missing dump + sha256 files. --partial resumes interrupted
# transfers; -z compresses in transit (dumps are already gzipped, gain kecil).
log "menarik dump baru via rsync..."
rsync -avz \
    --partial \
    --include='nextcrm-*.dump' \
    --include='nextcrm-*.dump.sha256' \
    --exclude='*' \
    -e "$RSYNC_SSH" \
    "${SSH_TARGET}:${VPS_VOLUME_PATH}/" \
    "$LOCAL_BACKUP_DIR/" \
    >> "$LOG_FILE" 2>&1

# Verify SHA-256 for every dump that has a paired .sha256 file.
verified=0
failed=0
for sha in "$LOCAL_BACKUP_DIR"/nextcrm-*.dump.sha256; do
    [ -f "$sha" ] || continue
    dump="${sha%.sha256}"
    if [ ! -f "$dump" ]; then
        log "skip verifikasi: ${dump} tidak ada (rsync mungkin belum selesai)."
        continue
    fi
    # sha256sum on Linux, shasum -a 256 on macOS.
    if command -v sha256sum >/dev/null 2>&1; then
        expected="$(awk '{print $1}' "$sha")"
        actual="$(sha256sum "$dump" | awk '{print $1}')"
    else
        expected="$(awk '{print $1}' "$sha")"
        actual="$(shasum -a 256 "$dump" | awk '{print $1}')"
    fi
    if [ "$expected" = "$actual" ]; then
        verified=$((verified + 1))
    else
        log "VERIFIKASI GAGAL: ${dump} (expected=${expected} actual=${actual}). Hapus dan pull ulang."
        rm -f "$dump" "$sha"
        failed=$((failed + 1))
    fi
done
log "verifikasi: ${verified} OK, ${failed} gagal."

# Prune local dumps older than RETENTION_DAYS (both .dump and .sha256).
pruned=0
if [ "$RETENTION_DAYS" -gt 0 ]; then
    while IFS= read -r -d '' f; do
        rm -f "$f"
        pruned=$((pruned + 1))
    done < <(find "$LOCAL_BACKUP_DIR" -type f \
        \( -name 'nextcrm-*.dump' -o -name 'nextcrm-*.dump.sha256' \) \
        -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)
fi
log "prune lokal: ${pruned} file lebih lama dari ${RETENTION_DAYS} hari dihapus."

# Show the latest local dump for quick confirmation.
latest="$(ls -1t "$LOCAL_BACKUP_DIR"/nextcrm-*.dump 2>/dev/null | head -1 || true)"
if [ -n "$latest" ]; then
    size="$(du -h "$latest" | awk '{print $1}')"
    log "dump lokal terbaru: $(basename "$latest") (${size})."
else
    log "tidak ada dump lokal."
fi

log "selesai."
