#!/usr/bin/env bash
#
# vps-dockerhub-poll.sh — detect a new :production image on DockerHub and
# trigger a pull-based update on the VPS.
#
# Designed to run from cron or a systemd timer every 3-5 minutes. It compares
# the remote manifest digest of each NextCRM image against the digest of the
# image the VPS currently holds. When any image differs (or is missing), it
# invokes deploy-production.sh --pull --non-interactive, which pulls, runs the
# one-shot migrator, recreates the app/scheduler/backup containers, waits for
# health, and verifies the public HTTPS endpoint.
#
# No inbound port is required: the VPS only reaches out to DockerHub.
#
# Configuration is read from .env.production (APP_IMAGE, APP_MIGRATOR_IMAGE,
# OPS_IMAGE, APP_IMAGE_TAG). The script is a no-op when APP_IMAGE is unset or
# does not contain a registry namespace (i.e. local builds are still in use).
#
# Logging target and lock file can be overridden via environment:
#   POLL_LOG=/var/log/nextcrm-poll.log
#   LOCK_FILE=/tmp/nextcrm-poll.lock
#   ENV_FILE=.env.production
#   DEPLOY_SCRIPT=./deploy-production.sh

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
POLL_LOG="${POLL_LOG:-/var/log/nextcrm-poll.log}"
LOCK_FILE="${LOCK_FILE:-/tmp/nextcrm-poll.lock}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-./deploy-production.sh}"

mkdir -p "$(dirname "$POLL_LOG")" 2>/dev/null || true
mkdir -p "$(dirname "$LOCK_FILE")" 2>/dev/null || true

log() {
    printf '[%s] [poll] %s\n' "$(date -Is)" "$*" >> "$POLL_LOG"
}

# Serialize runs so a slow deploy is never triggered twice in parallel.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log "instance lain sedang berjalan; keluar."
    exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
    log "$ENV_FILE tidak ditemukan; keluar."
    exit 0
fi

get_env() {
    local key="$1"
    local line value
    line="$(grep -m 1 "^${key}=" "$ENV_FILE" 2>/dev/null || true)"
    value="${line#*=}"
    value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    if [[ "$value" == \"*\" ]] && [[ "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

APP_IMAGE_TAG="$(get_env APP_IMAGE_TAG)"
APP_IMAGE_TAG="${APP_IMAGE_TAG:-production}"

APP_IMAGE="$(get_env APP_IMAGE)"
APP_MIGRATOR_IMAGE="$(get_env APP_MIGRATOR_IMAGE)"
OPS_IMAGE="$(get_env OPS_IMAGE)"

# No-op when CI images are not configured (local build mode still in use).
# A registry reference always contains a '/' (namespace/repo).
if [ -z "$APP_IMAGE" ] || [[ "$APP_IMAGE" != */* ]]; then
    log "APP_IMAGE belum menunjuk registry ('${APP_IMAGE:-kosong}'); mode lokal, keluar."
    exit 0
fi

# Resolve each image:env-default -> final ref. Skip any that are empty.
images=()
for ref in \
    "$APP_IMAGE" \
    "$APP_MIGRATOR_IMAGE" \
    "$OPS_IMAGE"; do
    [ -n "$ref" ] || continue
    images+=("${ref}:${APP_IMAGE_TAG}")
done

if [ "${#images[@]}" -eq 0 ]; then
    log "tidak ada image untuk diperiksa; keluar."
    exit 0
fi

remote_digest() {
    local image="$1"
    docker buildx imagetools inspect "$image" --format '{{.Manifest.Digest}}' 2>/dev/null \
        | tr -d '[:space:]' || true
}

local_digest() {
    local image="$1"
    local digest
    # RepoDigests look like "namespace/repo@sha256:..."; strip the part before '@'.
    digest="$(docker image inspect "$image" \
        --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
    [ -n "$digest" ] || return 0
    printf '%s' "${digest##*@}"
}

changed=false
for image in "${images[@]}"; do
    remote="$(remote_digest "$image")"
    if [ -z "$remote" ]; then
        log "tidak dapat mengambil digest remote untuk $image (jaringan/auth?); lewati."
        continue
    fi
    local_d="$(local_digest "$image")"
    if [ "$local_d" != "$remote" ]; then
        log "perubahan terdeteksi: $image (local='${local_d:-<tidak ada>}' remote='${remote}')."
        changed=true
    else
        log "tidak berubah: $image (${remote})."
    fi
done

if [ "$changed" != true ]; then
    exit 0
fi

log "memulai pembaruan via $DEPLOY_SCRIPT --pull --non-interactive."
if bash "$DEPLOY_SCRIPT" --pull --non-interactive >> "$POLL_LOG" 2>&1; then
    log "pembaruan selesai."
else
    log "pembaruan GAGAL (exit $?). Lihat log di atas dan $POLL_LOG."
    exit 0
fi
