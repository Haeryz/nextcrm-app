# Plan — CI/CD: GitHub Actions → DockerHub → VPS auto-pull

Tanggal: 2026-07-29
Status: Dikonfirmasi — siap dieksekusi

## Tujuan

Memindahkan build image dari VPS ke GitHub Actions, mengunggahnya ke DockerHub,
dan membuat VPS otomatis menarik serta menerapkan image baru ketika ada commit
baru di `main`. Tujuan akhirnya: setiap `git push` ke `main` langsung memperbarui
website produksi tanpa interaksi manual di server, sambil mempertahankan
jaminan ordering migrasi, health check, dan rollback yang sudah ada.

## Arsitektur

```text
git push main
    │
    ▼
GitHub Actions: buildx build 3 image
    │  build-args dari Secrets (NEXT_PUBLIC_*)
    ▼
DockerHub (private): push tag :production + :sha-<12>
    │
    ▼  (tidak ada inbound port ke VPS)
VPS cron poller (tiap 3-5 menit)
    │  bandingkan digest remote vs lokal
    │  bila berubah → ./deploy-production.sh --pull --non-interactive
    ▼
docker compose pull → run migrate (one-shot) → recreate app/scheduler/backup
    │  → wait health → check HTTPS publik
    ▼
web ter-update
```

## Keputusan (konfirmasi user)

- **Trigger build**: setiap push ke branch `main`.
- **Trigger update VPS**: polling digest DockerHub (tidak ada inbound port,
  jeda ~3-5 menit). Token read-only DockerHub untuk login di VPS.
- **Migrasi**: pertahankan one-shot migrator yang berjalan sebelum `appbuild`
  (mekanisme `depends_on: migrate: service_completed_successfully` yang sudah
  ada). Tidak memindahkan migrasi ke dalam container app.
- **Repo DockerHub**: privat; VPS login memakai token read-only.
- **Namespace DockerHub**: pakai placeholder `${DOCKERHUB_USERNAME}` di workflow
  GitHub dan variabel `APP_IMAGE`/`APP_MIGRATOR_IMAGE`/`OPS_IMAGE` di
  `.env.production`. Namespace asli diisi user satu kali (lihat Prasyarat).
- Rollback tetap memakai mekanisme lama: `APP_IMAGE_TAG=sha-<12>` + `up -d
  --no-build`.

## Image yang dibangun & di-push

Tiga image, masing-masing diberi tag `:production` (floating, yang dipull VPS)
dan `:sha-<12>` (immutable, untuk rollback):

| Image | Sumber build | Target |
| --- | --- | --- |
| `nextcrm-app` | `./Dockerfile` | `runner` |
| `nextcrm-migrator` | `./Dockerfile` | `migrator` |
| `nextcrm-ops` | `docker/ops/Dockerfile` | (default) |

`NEXT_PUBLIC_*` (APP_URL, MIDTRANS_CLIENT_KEY) hanya di-bake ke `nextcrm-app`
(target `runner`) melalui build-args dari GitHub Secrets. Image `migrator` dan
`ops` tidak membutuhkan build-arg tersebut. Runtime secret tetap hidup di
`.env.production` pada VPS dan tidak pernah masuk ke image → aman di-push ke
DockerHub.

## Perubahan

### 1. Workflow GitHub Actions (baru)

File baru: `.github/workflows/build-and-publish.yml`

- **Trigger**: `push` ke `main` + `workflow_dispatch` (manual).
- **concurrency**: `group: build-push`, `cancel-in-progress: false` (jangan
  membatalkan push yang sedang berjalan).
- **permissions**: `contents: read`.
- **Langkah**:
  1. `actions/checkout@v4`.
  2. Hitung `SHORT_SHA` = `git rev-parse --short=12 HEAD` → output step.
  3. `docker/setup-buildx-action@v3`.
  4. `docker/login-action@v3` memakai secrets `DOCKERHUB_USERNAME` +
     `DOCKERHUB_TOKEN` (token tulis).
  5. Build `nextcrm-app` (target `runner`) dengan `docker/build-push-action@v6`:
     - build-args: `NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-MektekCRM}`,
       `NEXT_PUBLIC_APP_URL` (required), `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
       (required) — semua dari secrets/env.
     - tags: `${{ secrets.DOCKERHUB_USERNAME }}/nextcrm-app:production`,
       `:sha-${{ steps.sha.outputs.short }}`.
     - cache: `type=gha,mode=max`.
  6. Build `nextcrm-migrator` (target `migrator`): tag `:production` + `:sha-*`.
  7. Build `nextcrm-ops` (`docker/ops/Dockerfile`): tag `:production` + `:sha-*`.
- **Tidak ada job deploy** di workflow karena VPS menarik sendiri (pull-based).

### 2. `docker-compose.yml` + override

- `docker-compose.yml` (base, produksi): hapus blok `build:` pada service
  `appbuild`, `migrate`, `scheduler`, `backup`. Pertahankan `image:`
  yang sudah ada:
  - `appbuild`: `image: ${APP_IMAGE:-nextcrm-app}:${APP_IMAGE_TAG:-production}`
  - `migrate`: `image: ${APP_MIGRATOR_IMAGE:-nextcrm-migrator}:${APP_IMAGE_TAG:-production}`
  - `scheduler` & `backup`: `image: ${OPS_IMAGE:-nextcrm-ops}:${APP_IMAGE_TAG:-production}`
  - Ubah default tag `:local` → `:production` agar pull-based default aman.
- File baru `docker-compose.override.yml.example`: memuat kembali blok `build:`
  lama (untuk membangun lokal saat development). Developer menyalinnya menjadi
  `docker-compose.override.yml` (compose otomatis merge).
- `.gitignore`: tambahkan `docker-compose.override.yml`.

### 3. `deploy-production.sh` — mode `--pull`

Tambah flag `--pull` pada `deploy-production.sh`. Perilaku:

- Sama seperti alur produksi yang ada, KECUALI:
  - Lompati `compose build --pull appbuild migrate scheduler` (baris 468).
  - Ganti dengan `compose pull appbuild migrate scheduler backup` (menarik
    image dari DockerHub memakai login read-only yang sudah ada).
- Pertahankan semua langkah setelahnya: nyalakan `supabase` + health, backup
  pre-migration bila tabel `_prisma_migrations` sudah ada, `compose rm -sf
  migrate`, `compose up -d --remove-orphans traefik appbuild scheduler backup`
  (migrate one-shot tetap dijalankan lebih dulu via `depends_on`), wait health
  `appbuild`/`traefik`/`scheduler`, `bootstrap_admin_if_needed`, cek HTTPS
  publik.
- Validasi `bash -n` setelah diedit (sudah dicakup `--check`).
- `--pull` boleh dikombinasikan dengan `--non-interactive` untuk dipanggil
  poller.

### 4. VPS poller (baru)

File baru: `scripts/vps-dockerhub-poll.sh`

- Dijalankan oleh cron atau systemd timer tiap 3-5 menit.
- Membaca `.env.production` untuk `APP_IMAGE`, `APP_MIGRATOR_IMAGE`, `OPS_IMAGE`,
  `APP_IMAGE_TAG` (default `production`). Namespace + repo diparse dari nilai
  tersebut.
- Untuk tiap repo, bandingkan digest:
  - Remote: `docker buildx imagetools inspect <image>:<tag> --format
    '{{.Manifest.Digest}}'` (buildx plugin sudah terpasang oleh
    `deploy-production.sh`; memakai auth dari `docker login`). Fallback:
    `curl` DockerHub API `/v2/repositories/<ns>/<repo>/tags/<tag>/` memakai
    token read-only bila buildx tidak membaca auth.
  - Lokal: `docker image inspect <image>:<tag> --format '{{index .RepoDigests
    0}}'` → strip prefix `...@`.
  - Bila salah satu berbeda, jalankan `./deploy-production.sh --pull
    --non-interactive`.
- `flock` agar tidak ada dua poller berjalan bersamaan.
- Log ke `/var/log/nextcrm-poll.log` (atau `logs/` bila tidak ada akses root).
- Keluar `0` walau tidak ada perubahan (cron senyap).

### 5. `.env.production.example` + `.gitignore`

- `.env.production.example`:
  - Perbarui komentar `APP_IMAGE_TAG` (line 17-19): jelaskan default `production`
    untuk CI/CD, dan `sha-<12>` untuk rollback.
  - Tambah blok baru "CI/CD — DockerHub":
    ```
    # Namespace image (tanpa tag). Diisi bila memakai image prebuilt dari CI.
    APP_IMAGE=
    APP_MIGRATOR_IMAGE=
    OPS_IMAGE=
    # Token read-only DockerHub untuk login di VPS (docker login).
    # Tidak disimpan di file ini; jalankan: docker login -u <user>
    DOCKERHUB_USERNAME=
    ```
  - Catatan: `NEXT_PUBLIC_APP_URL` dan `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` tetap
    ada di `.env.production` untuk referensi runtime, tetapi untuk build image
    nilai yang dipakai berasal dari GitHub Secrets.
- `.gitignore`: tambahkan `docker-compose.override.yml`.

### 6. Dokumentasi

Perbarui `docs/deployment-production-self-hosted.md` (Bahasa Indonesia, sesuai
kebijakan lokalisasi) dengan section baru "CI/CD via GitHub Actions + DockerHub":

- Arsitektur & alur (diagram di atas).
- Prasyarat manual (lihat bawah).
- Penjelasan mode `--pull` dan poller.
- Cron/systemd timer untuk poller.
- Prosedur rollback (`APP_IMAGE_TAG=sha-<12>` + `up -d --no-build`).
- Catatan: bila `NEXT_PUBLIC_*` berubah, image harus dibangun ulang oleh CI
  (sudah otomatis tiap push ke `main`).

## Prasyarat manual (dilakukan user satu kali)

1. **DockerHub**: buat 3 repo privat (`nextcrm-app`, `nextcrm-migrator`,
   `nextcrm-ops`) di bawah namespace user. Buat:
   - **Token tulis** (untuk GitHub Actions) → simpan sebagai GitHub Secret
     `DOCKERHUB_TOKEN`, dan `DOCKERHUB_USERNAME`.
   - **Token read-only** (untuk VPS).
2. **GitHub Secrets** (repo Settings → Secrets):
   - `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (tulis)
   - `NEXT_PUBLIC_APP_URL` (mis. `https://mektek.id`)
   - `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`
   - `NEXT_PUBLIC_APP_NAME` (opsional, default `MektekCRM`)
3. **VPS**:
   - `docker login -u <user> -p <token-read-only>`.
   - Isi `.env.production`: `APP_IMAGE=<user>/nextcrm-app`,
     `APP_MIGRATOR_IMAGE=<user>/nextcrm-migrator`,
     `OPS_IMAGE=<user>/nextcrm-ops`, `APP_IMAGE_TAG=production`.
   - Pasang cron/systemd timer untuk `scripts/vps-dockerhub-poll.sh` (tiap
     3-5 menit).
4. **Pertama kali**: jalankan `./deploy-production.sh --pull` untuk memastikan
   image dari DockerHub dapat dipull dan seluruh stack sehat.

## Verifikasi

- `./deploy-production.sh --check` lulus (validasi statis shell + compose).
- `docker compose --env-file .env.production config --quiet` lulus setelah
  blok `build:` dihapus.
- `bash -n scripts/vps-dockerhub-poll.sh` lulus.
- Workflow: picu `workflow_dispatch` di `main` → konfirmasi 6 tag (3 image ×
  `production` + `sha-<12>`) muncul di DockerHub.
- VPS: ubah tag image menjadi dummy lalu jalankan poller → poller mendeteksi
  perubahan digest dan memanggil `deploy-production.sh --pull`; `docker
  compose ps` sehat; `curl https://<domain>/api/health` `ready`.
- Rollback: `APP_IMAGE_TAG=sha-<12> docker compose --env-file .env.production
  up -d --no-build appbuild scheduler backup` → app kembali ke commit lama.
- Idempotensi: poller dijalankan ulang tanpa perubahan image → tidak memanggil
  `--pull`, exit `0`, tidak ada recreate container.

## Risiko & mitigasi

- **Migrasi tidak sengaja berjalan tiap poll**: poller membandingkan digest
  dulu dan hanya memanggil `--pull` saat berubah, jadi `migrate` one-shot tidak
  berjalan tanpa alasan.
- **Push gagal setengah jalan** (mis. `nextcrm-app` sukses, `nextcrm-ops`
  gagal): workflow membuat 3 langkah build berurutan dalam satu job; bila salah
  satu gagal, seluruh job gagal dan tag `:production` untuk image yang lain
  tidak diupdate (langkah berurutan, dijalankan berurutan). Tetap risiko tag
  `:production` satu image ter-update sebelum yang lain gagal → mitigasi:
  push semua tag di akhir (build semua dulu, lalu push), atau gunakan job
  terpisah dengan gate. Ditangani saat implementasi.
- **`NEXT_PUBLIC_*` berubah diam-diam**: dokumentasikan bahwa perubahan domain
  atau client key memerlukan rebuild (otomatis tiap push `main`).
- **Quota DockerHub**: private repo free tier memiliki batas pull; polling tiap
  3-5 menit menggunakan manifest check (ringan), bukan layer download.
- **Rollback tidak membatalkan migrasi**: sudah didokumentasikan di section
  rollback yang ada; gunakan backup pre-migration bila skema tidak kompatibel.

## Out of scope / follow-up

- Build multi-arch (ARM) via buildx — VPS saat ini AMD64.
- Job smoke-test di CI (menjalankan Postgres service container + migrate +
  curl `/api/health` sebelum push).
- Auto-rollback bila health gagal pasca-deploy (v1: rollback manual).
- Environment staging / promosi berbasis branch/tag.
- Signing image (cosign) + SBOM.
- DIUN sebagai compose service menggantikan cron poller.
