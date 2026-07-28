#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
ENV_TEMPLATE=".env.production.example"
CHECK_ONLY=false
UPDATE_FIRST=false
SKIP_DOCKER_INSTALL=false
NON_INTERACTIVE=false
DOCKER_CMD=()

green='\033[0;32m'
yellow='\033[1;33m'
red='\033[0;31m'
reset='\033[0m'

info() {
    printf "${green}[deploy]${reset} %s\n" "$*"
}

warn() {
    printf "${yellow}[peringatan]${reset} %s\n" "$*" >&2
}

die() {
    printf "${red}[gagal]${reset} %s\n" "$*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Penggunaan:
  ./deploy-production.sh
  ./deploy-production.sh --update
  ./deploy-production.sh --check

Opsi:
  --update               Jalankan git pull --ff-only sebelum deployment.
  --check                Validasi berkas tanpa memasang atau menjalankan container.
  --skip-docker-install  Jangan memasang Docker bila belum tersedia.
  --non-interactive      Jangan menampilkan prompt; semua nilai wajib harus tersedia.
  -h, --help             Tampilkan bantuan.

Variabel opsional untuk mode non-interaktif:
  APP_DOMAIN, TRAEFIK_ACME_EMAIL
  NEXTCRM_ADMIN_EMAIL, NEXTCRM_ADMIN_PASSWORD, NEXTCRM_ADMIN_NAME
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --update) UPDATE_FIRST=true ;;
        --check) CHECK_ONLY=true ;;
        --skip-docker-install) SKIP_DOCKER_INSTALL=true ;;
        --non-interactive) NON_INTERACTIVE=true ;;
        -h|--help) usage; exit 0 ;;
        *) die "Opsi tidak dikenal: $1" ;;
    esac
    shift
done

if [ ! -f "$ENV_TEMPLATE" ]; then
    die "$ENV_TEMPLATE tidak ditemukan. Jalankan skrip dari root repository."
fi

get_env() {
    local key="$1"
    local line=""
    local value=""

    if [ -f "$ENV_FILE" ]; then
        line="$(grep -m 1 "^${key}=" "$ENV_FILE" || true)"
    fi

    value="${line#*=}"
    value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    if [[ "$value" == \"*\" ]] && [[ "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
    fi

    printf '%s' "$value"
}

set_env() {
    local key="$1"
    local value="$2"
    local temp_file
    local found=false

    [[ "$value" != *$'\n'* ]] || die "Nilai $key tidak boleh mengandung baris baru."

    temp_file="$(mktemp "${ENV_FILE}.XXXXXX")"

    while IFS= read -r line || [ -n "$line" ]; do
        if [[ "$line" == "${key}="* ]]; then
            printf '%s=%s\n' "$key" "$value" >> "$temp_file"
            found=true
        else
            printf '%s\n' "$line" >> "$temp_file"
        fi
    done < "$ENV_FILE"

    if [ "$found" = false ]; then
        printf '\n%s=%s\n' "$key" "$value" >> "$temp_file"
    fi

    mv "$temp_file" "$ENV_FILE"
    chmod 0600 "$ENV_FILE"
}

prompt_value() {
    local key="$1"
    local label="$2"
    local default_value="${3:-}"
    local current_value="${!key:-}"
    local answer=""

    if [ -z "$current_value" ]; then
        current_value="$(get_env "$key")"
    fi

    if [ -n "$current_value" ]; then
        set_env "$key" "$current_value"
        return
    fi

    if [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
        [ -n "$default_value" ] || die "$key wajib diisi pada mode non-interaktif."
        set_env "$key" "$default_value"
        return
    fi

    if [ -n "$default_value" ]; then
        read -r -p "$label [$default_value]: " answer
        answer="${answer:-$default_value}"
    else
        read -r -p "$label: " answer
    fi

    [ -n "$answer" ] || die "$key wajib diisi."
    set_env "$key" "$answer"
}

generate_secret_if_missing() {
    local key="$1"
    local bytes="$2"

    if [ -z "$(get_env "$key")" ]; then
        set_env "$key" "$(openssl rand -hex "$bytes")"
        info "Membuat secret $key."
    fi
}

configure_resend() {
    local configure_answer=""
    local resend_key=""
    local transactional_from=""
    local marketing_from=""
    local app_domain=""

    if [ -n "$(get_env RESEND_API_KEY)" ] || [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
        return
    fi

    read -r -p "Konfigurasi Resend sekarang? [y/N]: " configure_answer
    case "$configure_answer" in
        y|Y|yes|YES) ;;
        *) return ;;
    esac

    read -r -s -p "Resend API key: " resend_key
    echo
    [ -n "$resend_key" ] || die "Resend API key tidak boleh kosong."

    app_domain="$(get_env APP_DOMAIN)"
    read -r -p "From email transaksional [MekTek <noreply@mail.${app_domain}>]: " transactional_from
    transactional_from="${transactional_from:-MekTek <noreply@mail.${app_domain}>}"
    read -r -p "From email marketing [MekTek <promo@news.${app_domain}>]: " marketing_from
    marketing_from="${marketing_from:-MekTek <promo@news.${app_domain}>}"

    set_env RESEND_API_KEY "$resend_key"
    set_env RESEND_FROM_EMAIL "$transactional_from"
    set_env EMAIL_MARKETING_FROM "$marketing_from"
    set_env EMAIL_UNSUBSCRIBE_BASE_URL "https://${app_domain}"
    unset resend_key

    warn "Pastikan mail.${app_domain} dan news.${app_domain} sudah verified di Resend."
}

validate_domain() {
    local domain="$1"
    [[ "$domain" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$ ]] \
        || die "APP_DOMAIN tidak valid: $domain"
}

validate_email() {
    local email="$1"
    [[ "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] \
        || die "Alamat email tidak valid: $email"
}

install_docker() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        return
    fi

    if [ "$SKIP_DOCKER_INSTALL" = true ]; then
        die "Docker Engine dan plugin Docker Compose belum tersedia."
    fi

    [ "$(uname -s)" = "Linux" ] || die "Pemasangan Docker otomatis hanya mendukung Linux."
    command -v apt-get >/dev/null 2>&1 || die "Pemasangan otomatis membutuhkan Ubuntu atau Debian."
    command -v sudo >/dev/null 2>&1 || [ "$(id -u)" -eq 0 ] || die "sudo diperlukan untuk memasang Docker."

    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}" in
        ubuntu|debian) ;;
        *) die "Distribusi ${ID:-tidak diketahui} belum didukung. Pasang Docker secara manual." ;;
    esac

    local sudo_cmd=()
    if [ "$(id -u)" -ne 0 ]; then
        sudo_cmd=(sudo)
    fi

    info "Memasang Docker Engine dari repository resmi Docker."
    "${sudo_cmd[@]}" apt-get update
    "${sudo_cmd[@]}" apt-get install -y ca-certificates curl
    "${sudo_cmd[@]}" install -m 0755 -d /etc/apt/keyrings
    "${sudo_cmd[@]}" curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
        -o /etc/apt/keyrings/docker.asc
    "${sudo_cmd[@]}" chmod a+r /etc/apt/keyrings/docker.asc

    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
        "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" \
        | "${sudo_cmd[@]}" tee /etc/apt/sources.list.d/docker.list >/dev/null

    "${sudo_cmd[@]}" apt-get update
    "${sudo_cmd[@]}" apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    "${sudo_cmd[@]}" systemctl enable --now docker
}

select_docker_command() {
    if docker info >/dev/null 2>&1; then
        DOCKER_CMD=(docker)
        return
    fi

    if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD=(sudo docker)
        return
    fi

    die "Docker daemon tidak dapat diakses. Periksa service Docker dan hak akses pengguna."
}

compose() {
    "${DOCKER_CMD[@]}" compose --env-file "$ENV_FILE" "$@"
}

container_status() {
    local service="$1"
    local container_id

    container_id="$(compose ps -q "$service")"
    [ -n "$container_id" ] || {
        printf 'missing'
        return
    }

    "${DOCKER_CMD[@]}" inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_id"
}

wait_for_health() {
    local service="$1"
    local timeout_seconds="$2"
    local elapsed=0
    local status=""

    info "Menunggu $service sehat."
    while [ "$elapsed" -lt "$timeout_seconds" ]; do
        status="$(container_status "$service" 2>/dev/null || true)"
        case "$status" in
            healthy|running)
                info "$service siap."
                return
                ;;
            unhealthy|exited|dead)
                compose logs --tail 100 "$service" || true
                die "$service berstatus $status."
                ;;
        esac
        sleep 5
        elapsed=$((elapsed + 5))
    done

    compose logs --tail 100 "$service" || true
    die "Timeout menunggu $service sehat."
}

bootstrap_admin_if_needed() {
    local database_name
    local admin_count
    local admin_email="${NEXTCRM_ADMIN_EMAIL:-}"
    local admin_password="${NEXTCRM_ADMIN_PASSWORD:-}"
    local admin_name="${NEXTCRM_ADMIN_NAME:-}"
    local password_confirmation=""

    database_name="$(get_env POSTGRES_DB)"
    database_name="${database_name:-nextcrm}"

    admin_count="$(
        compose exec -T supabase \
            psql -U postgres -d "$database_name" -tAc \
            'SELECT count(*) FROM "Users" WHERE is_admin = true;' \
            2>/dev/null | tr -d '[:space:]' || true
    )"

    if [[ "$admin_count" =~ ^[1-9][0-9]*$ ]]; then
        info "Akun owner sudah tersedia; bootstrap admin dilewati."
        return
    fi

    if [ -z "$admin_email" ]; then
        if [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
            die "NEXTCRM_ADMIN_EMAIL wajib tersedia untuk database baru."
        fi
        read -r -p "Email owner pertama [admin@$(get_env APP_DOMAIN)]: " admin_email
        admin_email="${admin_email:-admin@$(get_env APP_DOMAIN)}"
    fi
    validate_email "$admin_email"

    if [ -z "$admin_name" ]; then
        admin_name="MekTek Admin"
    fi

    if [ -z "$admin_password" ]; then
        if [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
            die "NEXTCRM_ADMIN_PASSWORD wajib tersedia untuk database baru."
        fi
        read -r -s -p "Password owner pertama (minimal 12 karakter): " admin_password
        echo
        read -r -s -p "Ulangi password owner: " password_confirmation
        echo
        [ "$admin_password" = "$password_confirmation" ] || die "Konfirmasi password tidak sama."
    fi

    [ "${#admin_password}" -ge 12 ] || die "Password owner minimal 12 karakter."

    info "Membuat akun owner pertama."
    NEXTCRM_ADMIN_EMAIL="$admin_email" \
    NEXTCRM_ADMIN_PASSWORD="$admin_password" \
    NEXTCRM_ADMIN_NAME="$admin_name" \
        compose --profile tools run --rm --no-deps admin-bootstrap

    unset admin_password password_confirmation NEXTCRM_ADMIN_PASSWORD
}

print_failure_context() {
    local exit_code="$?"
    if [ "$exit_code" -ne 0 ] && [ "${#DOCKER_CMD[@]}" -gt 0 ] && [ -f "$ENV_FILE" ]; then
        warn "Deployment gagal. Status container terakhir:"
        compose ps 2>/dev/null || true
    fi
}

trap print_failure_context EXIT

if [ "$UPDATE_FIRST" = true ]; then
    command -v git >/dev/null 2>&1 || die "git tidak tersedia."
    [ -z "$(git status --porcelain)" ] || die "Worktree memiliki perubahan. Selesaikan perubahan sebelum --update."
    info "Mengambil perubahan terbaru dengan fast-forward."
    git pull --ff-only
fi

if [ "$CHECK_ONLY" = true ]; then
    original_env_file="$ENV_FILE"
    check_env_file="$(mktemp)"
    ENV_FILE="$check_env_file"
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    set_env APP_DOMAIN "example.com"
    set_env TRAEFIK_ACME_EMAIL "admin@example.com"
    set_env POSTGRES_PASSWORD "check-only-postgres-password"
    set_env NEXTAUTH_SECRET "check-only-nextauth-secret"
    set_env JWT_SECRET "check-only-jwt-secret"
    set_env EMAIL_ENCRYPTION_KEY "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    set_env CRON_SECRET "check-only-cron-secret"

    info "Menjalankan validasi statis."
    bash -n deploy-production.sh setup.sh entrypoint.sh
    for script in docker/ops/*.sh; do
        sh -n "$script"
    done
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        docker compose --env-file "$ENV_FILE" config --quiet
        info "Sintaks shell dan Docker Compose valid."
    else
        info "Sintaks shell valid. Docker belum tersedia sehingga validasi Compose dilewati."
    fi
    rm -f "$check_env_file"
    ENV_FILE="$original_env_file"
    exit 0
fi

[ "$(uname -s)" = "Linux" ] || die "Deployment produksi hanya didukung pada server Linux."
command -v openssl >/dev/null 2>&1 || die "openssl wajib tersedia."

if [ ! -f "$ENV_FILE" ]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    chmod 0600 "$ENV_FILE"
    info "Membuat $ENV_FILE dari template."
fi

prompt_value APP_DOMAIN "Domain publik aplikasi" "mektek.id"
prompt_value TRAEFIK_ACME_EMAIL "Email untuk notifikasi sertifikat HTTPS"

app_domain="$(get_env APP_DOMAIN)"
acme_email="$(get_env TRAEFIK_ACME_EMAIL)"
validate_domain "$app_domain"
validate_email "$acme_email"

generate_secret_if_missing POSTGRES_PASSWORD 32
generate_secret_if_missing NEXTAUTH_SECRET 32
generate_secret_if_missing JWT_SECRET 32
generate_secret_if_missing EMAIL_ENCRYPTION_KEY 32
generate_secret_if_missing CRON_SECRET 32
configure_resend

if [ -n "$(get_env RESTIC_REPOSITORY)" ] && [ -z "$(get_env RESTIC_PASSWORD)" ]; then
    generate_secret_if_missing RESTIC_PASSWORD 32
fi

if [ "$(get_env NEXTCRM_DISABLE_AUTH)" != "false" ]; then
    die "NEXTCRM_DISABLE_AUTH harus false pada production."
fi

chmod 0600 "$ENV_FILE"
install_docker
select_docker_command

configured_image_tag="${APP_IMAGE_TAG:-$(get_env APP_IMAGE_TAG)}"
if [ -n "$configured_image_tag" ]; then
    export APP_IMAGE_TAG="$configured_image_tag"
elif command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    export APP_IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
else
    export APP_IMAGE_TAG="production"
fi

info "Memvalidasi konfigurasi Docker Compose."
compose config --quiet

info "Membangun image aplikasi dan operasional."
compose build --pull appbuild migrate scheduler

info "Menyalakan PostgreSQL."
compose up -d supabase
wait_for_health supabase 180

database_name="$(get_env POSTGRES_DB)"
database_name="${database_name:-nextcrm}"
[[ "$database_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] \
    || die "POSTGRES_DB harus berupa identifier PostgreSQL yang aman."

info "Memastikan role aplikasi memiliki database dan schema public."
compose exec -T supabase \
    psql -U supabase_admin -d "$database_name" \
    -v ON_ERROR_STOP=1 \
    -c "ALTER DATABASE \"$database_name\" OWNER TO postgres;" \
    -c 'ALTER SCHEMA public OWNER TO postgres; GRANT ALL ON SCHEMA public TO postgres;' \
    >/dev/null

existing_migrations="$(
    compose exec -T supabase \
        psql -U postgres -d "$database_name" -tAc \
        "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;" \
        2>/dev/null | tr -d '[:space:]' || true
)"
if [ "$existing_migrations" = "t" ]; then
    info "Membuat backup sebelum migrasi dan penggantian aplikasi."
    compose run --rm --no-deps --entrypoint /usr/local/bin/backup-now backup
fi

info "Menyalakan Traefik, NextCRM, scheduler, dan backup."
compose rm -sf migrate >/dev/null 2>&1 || true
compose up -d --remove-orphans traefik appbuild scheduler backup
wait_for_health appbuild 300
wait_for_health traefik 120
wait_for_health scheduler 120

bootstrap_admin_if_needed

info "Status akhir container:"
compose ps

if command -v curl >/dev/null 2>&1; then
    if curl --fail --silent --show-error --max-time 20 \
        "https://${app_domain}/api/health" >/dev/null 2>&1; then
        info "Pemeriksaan publik HTTPS berhasil."
    else
        warn "Container sehat, tetapi HTTPS publik belum dapat diverifikasi."
        warn "Periksa DNS Cloudflare, SSL/TLS Full (strict), dan firewall port 80/443."
    fi
fi

trap - EXIT
echo
info "Deployment selesai: https://${app_domain}"
info "Log aplikasi: ${DOCKER_CMD[*]} compose --env-file $ENV_FILE logs -f appbuild"
info "Panduan lengkap: docs/deployment-production-self-hosted.md"
