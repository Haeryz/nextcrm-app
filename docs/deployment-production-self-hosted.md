# Deployment Production NextCRM MekTek di Server Sendiri

Dokumen ini adalah panduan resmi untuk menjalankan NextCRM MekTek pada satu
server Linux menggunakan Docker Compose, Traefik, PostgreSQL, Cloudflare, dan
Resend.

Target akhirnya:

```text
Pengunjung
    |
    v
Cloudflare DNS + Proxy
    |
    v
Server publik: port 80 dan 443
    |
    v
Traefik
    |
    v
NextCRM ----> Resend / Midtrans
    |
    v
PostgreSQL pada jaringan Docker privat
```

Container yang dijalankan:

| Container | Fungsi | Akses publik |
| --- | --- | --- |
| `traefik` | Reverse proxy dan sertifikat HTTPS | Port 80 dan 443 |
| `appbuild` | Aplikasi NextCRM | Tidak langsung |
| `supabase` | PostgreSQL dengan extension yang diperlukan | Tidak |
| `migrate` | Menjalankan migrasi Prisma sekali sebelum aplikasi mulai | Tidak |
| `scheduler` | Menjalankan reminder dan kampanye terjadwal | Tidak |
| `backup` | Backup PostgreSQL harian | Tidak |

> Nama service `supabase` pada Compose adalah PostgreSQL untuk aplikasi ini,
> bukan seluruh platform Supabase.

## 1. Batas Otomatisasi

Perintah deployment dapat memasang Docker, membuat secret, membangun image,
menjalankan migrasi, menyalakan container, membuat owner pertama, membuat
backup, dan memeriksa kesehatan aplikasi.

Perubahan berikut tetap harus dilakukan melalui dashboard pemilik layanan:

- Mengarahkan DNS `mektek.id` pada Cloudflare.
- Menambahkan record verifikasi Resend.
- Mendapatkan API key Resend dan Midtrans.
- Membeli atau menyiapkan server.

Hal tersebut tidak diotomatisasi karena membutuhkan akses ke akun eksternal dan
berisiko mengubah DNS atau layanan lain yang sudah menggunakan domain tersebut.

## 2. Spesifikasi Server yang Disarankan

Gunakan VPS atau dedicated server dengan:

- Ubuntu atau Debian versi LTS yang masih didukung.
- Arsitektur AMD64 untuk kompatibilitas paling mudah.
- 2 vCPU minimum.
- RAM 4 GB minimum, 8 GB disarankan saat build dilakukan di server.
- SSD minimal 60 GB.
- IPv4 publik statis.
- Port TCP 80 dan 443 dapat diakses dari internet.
- Akses SSH menggunakan key.

Jangan memilih server rumahan yang berada di balik CGNAT bila ingin
menghilangkan Cloudflare Tunnel. Traefik tidak dapat menerima koneksi internet
tanpa IP publik atau port forwarding.

## 3. Persiapan Cloudflare

Domain tetap terdaftar di Domainesia. Bila nameserver domain sudah menunjuk ke
Cloudflare, seluruh record DNS dikelola dari dashboard Cloudflare.

### 3.1 Jangan hapus tunnel lama terlebih dahulu

Tunnel dari laptop dipertahankan sampai server baru sehat. Error 502 saat
`docker compose down` di laptop berarti Cloudflare dapat dijangkau, tetapi
origin lokal berhenti.

Urutan migrasi yang aman:

1. Siapkan server baru dan catat IPv4 publiknya.
2. Di Cloudflare DNS, siapkan record `A` untuk hostname sementara, misalnya
   `staging.mektek.id`, menuju IPv4 server.
3. Set record tersebut menjadi **DNS only** selama penerbitan sertifikat
   pertama.
4. Jalankan deployment menggunakan hostname sementara.
5. Pastikan `https://staging.mektek.id/api/health` mengembalikan status `ready`.
6. Ubah record menjadi **Proxied** setelah HTTPS berhasil.
7. Saat siap pindah, ganti record `mektek.id` dari target Tunnel menjadi record
   `A` yang menunjuk ke IPv4 server.
8. Jalankan deployment kembali dengan `APP_DOMAIN=mektek.id`.
9. Pastikan website dan webhook bekerja.
10. Nonaktifkan lalu hapus Tunnel lama.

Untuk langsung memakai `mektek.id`, langkah hostname sementara dapat dilewati,
tetapi perubahan DNS akan memindahkan traffic production saat itu juga.

### 3.2 SSL/TLS Cloudflare

Setelah sertifikat Traefik berhasil diterbitkan:

1. Buka Cloudflare.
2. Pilih `mektek.id`.
3. Buka **SSL/TLS**.
4. Pilih **Full (strict)**.
5. Jangan gunakan **Flexible**, karena dapat menimbulkan redirect loop dan
   koneksi origin yang tidak terenkripsi.

## 4. Persiapan Firewall Server

Pastikan akses SSH sudah bekerja sebelum mengaktifkan firewall.

Contoh untuk UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Jangan membuka port berikut ke internet:

- `3000` untuk NextCRM.
- `5432` untuk PostgreSQL.
- Dashboard Traefik.
- Docker daemon `2375` atau `2376`.

## 5. Clone Repository

Masuk ke server melalui SSH:

```bash
ssh nama-user@IP_SERVER
```

Clone repository dan masuk ke direktori:

```bash
git clone URL_REPOSITORY_ANDA nextcrm-app
cd nextcrm-app
```

Untuk repository privat, gunakan SSH deploy key atau kredensial Git yang
memiliki akses baca saja bila memungkinkan.

## 6. Deployment dengan Satu Perintah

Jalankan:

```bash
./deploy-production.sh
```

Alias berikut menjalankan proses yang sama:

```bash
./setup.sh
```

Pada deployment pertama, skrip akan meminta:

- Domain publik aplikasi.
- Email untuk notifikasi sertifikat Let's Encrypt.
- Pilihan konfigurasi Resend.
- Email, nama, dan password owner pertama.

Password owner minimal 12 karakter dan tidak disimpan ke
`.env.production`. Secret sistem dibuat otomatis dan berkas environment
diberi permission `0600`.

Skrip kemudian:

1. Memasang Docker Engine dan Docker Compose dari repository resmi Docker bila
   belum tersedia.
2. Memvalidasi `.env.production`.
3. Membuat image berdasarkan commit Git saat ini.
4. Menyalakan dan memeriksa PostgreSQL.
5. Membuat backup sebelum migrasi bila database lama terdeteksi.
6. Menjalankan migrasi Prisma melalui container one-shot `migrate`; aplikasi
   hanya dimulai bila migrasi berhasil.
7. Menyalakan Traefik, NextCRM, scheduler, dan backup.
8. Menunggu semua health check.
9. Membuat owner pertama bila belum ada owner.
10. Memeriksa endpoint HTTPS publik.

Deployment bersifat idempotent. Menjalankan perintah yang sama kembali tidak
merotasi secret, tidak menghapus volume, dan tidak membuat owner ganda.

## 7. Deployment Non-interaktif

Untuk automation, sediakan nilai melalui environment:

```bash
APP_DOMAIN=mektek.id \
TRAEFIK_ACME_EMAIL=admin@mektek.id \
NEXTCRM_ADMIN_EMAIL=admin@mektek.id \
NEXTCRM_ADMIN_PASSWORD='PASSWORD_YANG_SANGAT_KUAT' \
NEXTCRM_ADMIN_NAME='Owner MekTek' \
./deploy-production.sh --non-interactive
```

Gunakan secret manager CI/CD bila perintah dijalankan oleh pipeline. Jangan
menaruh password pada script, commit Git, shell history, atau dokumentasi.

## 8. Konfigurasi Resend

Resend tidak berhubungan dengan Traefik atau Cloudflare Tunnel. Resend hanya
memerlukan API key dan record DNS yang valid.

Pisahkan reputasi email:

- Transaksional: `mail.mektek.id`
- Marketing: `news.mektek.id`

Contoh environment:

```env
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=MekTek <noreply@mail.mektek.id>
EMAIL_MARKETING_FROM=MekTek <promo@news.mektek.id>
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxx
EMAIL_UNSUBSCRIBE_BASE_URL=https://mektek.id
```

Langkah verifikasi:

1. Tambahkan `mail.mektek.id` di dashboard Resend.
2. Salin record SPF, DKIM, dan MX yang diberikan Resend ke Cloudflare DNS.
3. Tambahkan `news.mektek.id` dan record yang diberikan.
4. Semua record email harus **DNS only**, bukan Proxied.
5. Jangan mengganti MX root `mektek.id` bila sudah dipakai provider mailbox.
6. Jangan membuat dua record SPF pada hostname yang sama.
7. Klik **Verify DNS Records** di Resend.
8. Tambahkan webhook:

   ```text
   https://mektek.id/api/resend-webhook
   ```

9. Salin signing secret webhook ke `RESEND_WEBHOOK_SECRET`.
10. Jalankan kembali:

    ```bash
    ./deploy-production.sh
    ```

Tambahkan DMARC setelah SPF dan DKIM berhasil. Mulai dengan kebijakan monitoring
dan tingkatkan kebijakan setelah laporan email dinilai.

## 9. Konfigurasi Midtrans

Gunakan sandbox sampai alur pembayaran lengkap sudah diuji.

Isi `.env.production`:

```env
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxx
```

Atur notification URL pada Midtrans:

```text
https://mektek.id/api/mektek/payments/notification
```

Setelah mengubah `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, image harus dibangun ulang
karena nilai `NEXT_PUBLIC_*` dimasukkan pada waktu build:

```bash
./deploy-production.sh
```

Jangan pernah memakai kartu atau rekening pembayaran nyata ketika
`MIDTRANS_IS_PRODUCTION=false`.

## 10. Backup

Container backup membuat PostgreSQL custom-format dump setiap 24 jam dan
menyimpan 14 hari secara default.

Konfigurasi:

```env
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=14
```

### 10.1 Backup manual

```bash
docker compose --env-file .env.production run \
  --rm \
  --no-deps \
  --entrypoint /usr/local/bin/backup-now \
  backup
```

### 10.2 Melihat backup

```bash
docker compose --env-file .env.production exec backup \
  ls -lh /backups
```

### 10.3 Backup off-site

Backup pada server yang sama tidak cukup untuk production. Gunakan storage
S3-compatible dan Restic:

```env
RESTIC_REPOSITORY=s3:https://ENDPOINT_S3/BUCKET/nextcrm
RESTIC_PASSWORD=PASSWORD_RESTIC_YANG_KUAT
AWS_ACCESS_KEY_ID=ACCESS_KEY
AWS_SECRET_ACCESS_KEY=SECRET_KEY
AWS_DEFAULT_REGION=auto
```

Setelah menyimpan konfigurasi:

```bash
./deploy-production.sh
```

Skrip deployment membuat `RESTIC_PASSWORD` otomatis bila repository sudah
diisi tetapi password masih kosong.

## 11. Restore Database

Restore adalah tindakan destruktif. Buat backup baru sebelum restore dan
pastikan nama file sudah benar.

1. Lihat daftar backup:

   ```bash
   docker compose --env-file .env.production exec backup \
     ls -lh /backups
   ```

2. Hentikan aplikasi, scheduler, dan backup:

   ```bash
   docker compose --env-file .env.production stop \
     appbuild scheduler backup
   ```

3. Restore file yang dipilih:

   ```bash
   docker compose --env-file .env.production run \
     --rm \
     --no-deps \
     -e RESTORE_FILE=/backups/NAMA_FILE.dump \
     -e CONFIRM_RESTORE=RESTORE_NEXTCRM \
     --entrypoint /usr/local/bin/restore-backup \
     backup
   ```

4. Nyalakan kembali:

   ```bash
   docker compose --env-file .env.production up -d \
     appbuild scheduler backup
   ```

5. Periksa health dan log.

Restore sebaiknya diuji berkala pada server non-production.

## 12. Update dengan Satu Perintah

Bila worktree bersih:

```bash
./deploy-production.sh --update
```

Opsi ini menjalankan `git pull --ff-only`, membuat backup pre-migration,
membangun image commit baru, dan mengganti container.

Jangan memakai:

```bash
docker compose down
```

untuk update rutin. Perintah tersebut sengaja menghentikan seluruh origin dan
akan menyebabkan Cloudflare menampilkan 502/521 sampai aplikasi dinyalakan
kembali.

## 13. Rollback Image

Lihat image yang masih tersedia:

```bash
docker images nextcrm-app
docker images nextcrm-ops
```

Gunakan tag commit sebelumnya:

```bash
APP_IMAGE_TAG=TAG_COMMIT_SEBELUMNYA \
docker compose --env-file .env.production up -d \
  --no-build appbuild scheduler backup
```

Rollback image tidak otomatis membatalkan migrasi database. Bila perubahan
database tidak kompatibel, gunakan prosedur restore dari backup pre-migration.

## 14. Pemeriksaan Operasional

Status:

```bash
docker compose --env-file .env.production ps
```

Health internal:

```bash
docker compose --env-file .env.production exec appbuild \
  wget -qO- http://127.0.0.1:3000/api/health
```

Health publik:

```bash
curl -fsS https://mektek.id/api/health
```

Log aplikasi:

```bash
docker compose --env-file .env.production logs -f appbuild
```

Log Traefik:

```bash
docker compose --env-file .env.production logs -f traefik
```

Log scheduler:

```bash
docker compose --env-file .env.production logs -f scheduler
```

Log backup:

```bash
docker compose --env-file .env.production logs -f backup
```

Validasi repository tanpa deployment:

```bash
./deploy-production.sh --check
```

## 15. Jadwal Otomatis

Scheduler mempertahankan jadwal Vercel sebelumnya dalam UTC:

| Pekerjaan | UTC | WITA |
| --- | --- | --- |
| Reminder mingguan | Senin 02:00 | Senin 10:00 |
| Reminder Finance | Setiap hari 02:00 | Setiap hari 10:00 |
| Kampanye marketing | Senin 03:00 | Senin 11:00 |
| Penawaran | Jumat 03:00 | Jumat 11:00 |

Setiap request menggunakan header `Authorization: Bearer <CRON_SECRET>`.

## 16. Troubleshooting Cloudflare

### 502 Bad Gateway

Kemungkinan:

- Container aplikasi berhenti.
- Traefik tidak dapat mencapai `appbuild`.
- Tunnel lama masih menunjuk ke laptop.

Periksa:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 100 appbuild traefik
```

### 521 Web Server Is Down

Cloudflare tidak dapat membuka koneksi ke origin. Periksa:

- Record DNS menunjuk ke IPv4 yang benar.
- Port 80/443 dibuka pada firewall server dan firewall provider.
- Container Traefik berjalan.

### 525 SSL Handshake Failed

Periksa sertifikat Traefik dan mode SSL Cloudflare.

### 526 Invalid SSL Certificate

Cloudflare menggunakan Full (strict), tetapi origin belum menyajikan sertifikat
valid untuk hostname tersebut. Periksa log Traefik:

```bash
docker compose --env-file .env.production logs --tail 200 traefik
```

Untuk penerbitan sertifikat pertama, gunakan record DNS only sampai HTTPS origin
berhasil, lalu aktifkan proxy Cloudflare kembali.

## 17. Perawatan Production

Lakukan secara rutin:

- Update sistem operasi dan Docker.
- Jalankan `./deploy-production.sh --update` setelah perubahan diuji.
- Pantau penggunaan disk Docker dan backup.
- Verifikasi backup off-site.
- Uji restore.
- Rotasi API key bila bocor.
- Aktifkan 2FA pada Cloudflare, Resend, Midtrans, Domainesia, dan Git provider.
- Batasi akses repository dan server.
- Jangan commit `.env.production`.
- Jangan expose PostgreSQL atau Docker daemon.
- Jangan menjalankan production dengan `NEXTCRM_DISABLE_AUTH=true`.

## 18. Checklist Go-Live

- [ ] Server memiliki IP publik statis.
- [ ] SSH key dan firewall sudah dikonfigurasi.
- [ ] DNS mengarah ke server.
- [ ] Traefik, app, database, scheduler, dan backup sehat.
- [ ] Cloudflare menggunakan Full (strict).
- [ ] Owner pertama dapat login.
- [ ] `NEXTCRM_DISABLE_AUTH=false`.
- [ ] Resend SPF/DKIM verified.
- [ ] Webhook Resend verified.
- [ ] Midtrans masih sandbox sampai pengujian selesai.
- [ ] Notification URL Midtrans dapat dijangkau.
- [ ] Backup lokal berhasil.
- [ ] Backup off-site berhasil.
- [ ] Restore pernah diuji.
- [ ] Tunnel laptop sudah dinonaktifkan setelah server baru stabil.
