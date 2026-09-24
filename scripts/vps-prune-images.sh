#!/usr/bin/env bash
#
# vps-prune-images.sh — delete Docker images no container uses, so the VPS
# keeps only the images it is actually running and every deploy has room to
# pull the new :production images.
#
# Why: the VPS disk is small (30 GB). Each deploy pulls new app/migrator/ops
# images while the previous ones stay on disk as untagged leftovers. Nothing
# ever removed them, the disk hit 99%, and every pull after that failed with
# "no space left on device" — production silently stayed on an old build.
#
# What is removed (all safe, re-pullable from DockerHub):
#   - every image not referenced by any container (running OR stopped).
#     Stopped containers keep their image, so the one-shot `migrate`
#     container's image is kept until the next deploy recreates it.
#   - partial layers/content left behind by interrupted or failed pulls
#   - build cache (the VPS never builds; CI does)
#
# Never touched: containers, volumes (database + backups), networks.
#
# Called by scripts/vps-dockerhub-poll.sh before each pull (to make room) and
# after each successful deploy (to drop the images it just replaced). Safe to
# run by hand at any time:
#   ./scripts/vps-prune-images.sh
#
# Environment:
#   POLL_LOG=/var/log/nextcrm-poll.log   where to log (stdout when unset)

set -Eeuo pipefail

log() {
    local line
    line="$(printf '[%s] [prune] %s' "$(date -Is)" "$*")"
    if [ -n "${POLL_LOG:-}" ]; then
        printf '%s\n' "$line" >> "$POLL_LOG"
    else
        printf '%s\n' "$line"
    fi
}

disk_free() {
    df -h --output=avail,pcent / 2>/dev/null | tail -1 | awk '{print $1 " bebas (" $2 " terpakai)"}'
}

if ! command -v docker >/dev/null 2>&1; then
    log "docker tidak ditemukan; lewati."
    exit 0
fi

log "sebelum: $(disk_free)."

# -a: all unused images, not only dangling ones. An image is "used" while any
# container (even an exited one) references it, so running services and the
# last migrator run are always kept.
reclaimed_images="$(docker image prune -af 2>&1 | awk '/Total reclaimed space/ {print $4}')"
reclaimed_cache="$(docker builder prune -af 2>&1 | awk '/Total/ {print $NF}')"

log "image dihapus: ${reclaimed_images:-0B}; build cache: ${reclaimed_cache:-0B}."
log "sesudah: $(disk_free)."
