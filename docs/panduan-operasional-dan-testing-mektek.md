# Panduan Operasional dan Testing Aplikasi MekTek

**Dokumen:** Panduan penggunaan website dari sisi admin, staf, dan customer  
**Aplikasi:** NextCRM App - MekTek Core  
**Tujuan:** Menjadi acuan resmi untuk pelatihan pengguna, pengoperasian harian, dan testing/UAT oleh tim internal.  
**Ruang lingkup:** Authentication, dashboard operasional, order servis, katalog sparepart, tracking customer, pembayaran, dokumen invoice/struk, WhatsApp, dan customer profile.  

---

## 1. Ringkasan Aplikasi

Website MekTek digunakan untuk mengelola proses servis alat berat atau kendaraan mulai dari penerimaan order, pencatatan customer, pencatatan pekerjaan, pemilihan sparepart, update progress, pengelolaan pembayaran, pembuatan invoice/struk, hingga penyediaan link tracking untuk customer.

Alur utama aplikasi adalah sebagai berikut:

1. Staff membuat service order baru.
2. Sistem menyimpan data customer berdasarkan nomor telepon.
3. Sistem membuat link tracking privat untuk customer.
4. Teknisi atau admin memperbarui timeline pekerjaan dan status order.
5. Admin mengelola pembayaran, diskon, pajak/biaya lain, invoice, dan struk.
6. Customer memantau progress melalui link tracking atau halaman customer profile.

---

## 2. Peran Pengguna dan Hak Akses

| Peran | Deskripsi | Hak akses utama |
| --- | --- | --- |
| Admin | Pengguna dengan akses tertinggi pada workflow MekTek. | Melihat dashboard, membuat order, mengelola katalog, melihat tracking link, mengubah status/timeline, mengelola pembayaran, membuka dokumen, dan memakai fitur WhatsApp. |
| CS | Customer service atau staf penerima order. | Membuat service order, mengelola katalog, melihat daftar order, membuka detail order, melihat tracking link, membuka dokumen, dan memakai fitur WhatsApp. |
| Technician | Teknisi yang menangani progress pekerjaan. | Melihat workspace MekTek, membuka detail order, menambah timeline, dan mengubah status pekerjaan. Tidak dapat membuat order baru dan tidak dapat mengubah pembayaran. |
| Customer | Pelanggan MekTek. | Melihat halaman customer, mencari katalog sparepart, membuat akun customer, membuka customer profile, melihat status servis, melihat invoice, dan melihat struk sesuai order yang terhubung ke nomor teleponnya. |

Catatan penting:

- Admin dan CS dapat membuat service order baru.
- Admin dan CS dapat mengelola katalog sparepart.
- Admin dan Technician dapat memperbarui timeline dan status pekerjaan.
- Hanya Admin yang dapat mengelola pembayaran.
- Customer hanya melihat data servis yang terhubung dengan nomor telepon atau link tracking privat.

---

## 3. Struktur Halaman Utama

| Halaman | URL umum | Pengguna |
| --- | --- | --- |
| Login | `/sign-in` atau `/{locale}/sign-in` | Semua pengguna |
| Register | `/register` atau `/{locale}/register` | Customer dan Staff |
| Customer Home | `/{locale}/customer` | Customer/publik |
| Customer Catalogue | `/{locale}/customer?view=sparepart` | Customer/publik |
| Customer Profile | `/{locale}/customer/profile` | Customer login |
| Dashboard MekTek | `/{locale}/mektek/dashboard` | Admin, CS, Technician |
| Service Order List/Intake | `/{locale}/mektek` | Admin, CS, Technician |
| Service Order Detail | `/{locale}/mektek/{serviceOrderId}` | Admin, CS, Technician |
| Catalogue Items Admin | `/{locale}/mektek/items` | Admin, CS |
| WhatsApp Setup | `/{locale}/mektek/whatsapp` | Admin/CS sesuai akses navigasi |
| Customer Tracking Short Link | `/{locale}/s/{code}` | Customer dengan link |
| Customer Tracking Token Link | `/{locale}/service-status/{id}?token={token}` | Customer dengan token |

`locale` yang tersedia pada aplikasi adalah `en`, `de`, `cz`, dan `uk`. Contoh penggunaan umum: `/en/mektek/dashboard`.

---

## 4. Prasyarat Sebelum Testing

Sebelum testing dilakukan, pastikan kondisi berikut sudah terpenuhi:

1. Aplikasi dapat dijalankan dan halaman login dapat diakses.
2. Database sudah tersedia dan migration sudah diterapkan.
3. Akun testing sudah disiapkan untuk setiap peran:
   - Admin
   - CS
   - Technician
   - Customer
4. Minimal satu item katalog tersedia untuk testing pencarian sparepart.
5. Nomor telepon testing menggunakan format yang konsisten, misalnya `+628123456789`.
6. Browser testing menggunakan mode normal atau incognito sesuai kebutuhan.
7. Jika menguji WhatsApp, pastikan backend WhatsApp dan session WhatsApp sudah dikonfigurasi.

Command teknis yang tersedia untuk verifikasi developer:

```bash
pnpm install
pnpm dev
pnpm exec prisma validate
pnpm test
pnpm test:e2e
```

---

## 5. Panduan Penggunaan untuk Admin

### 5.1 Login sebagai Admin

1. Buka halaman `/sign-in`.
2. Isi field **E-mail or phone number** dengan email admin.
3. Isi field **Password**.
4. Klik tombol **Login**.
5. Pastikan login berhasil dan aplikasi mengarah ke halaman dengan prefix locale, misalnya `/en`.

Hasil yang diharapkan:

- Admin berhasil masuk ke sistem.
- Admin dapat membuka halaman `/en/mektek/dashboard`.
- Admin dapat melihat fitur pembayaran pada detail service order.

### 5.2 Melihat Dashboard Operasional

1. Buka halaman `/en/mektek/dashboard`.
2. Periksa ringkasan operasional yang tampil:
   - **Open orders**
   - **Due today**
   - **Overdue**
   - **Completed today**
   - **Unpaid balance**
3. Lihat bagian **Recent orders**.
4. Gunakan pagination jika jumlah order lebih dari satu halaman.
5. Klik salah satu order untuk membuka detail order.

Hasil yang diharapkan:

- Data dashboard tampil tanpa error.
- Setiap kartu ringkasan menampilkan angka atau nilai yang valid.
- Recent orders dapat dibuka ke halaman detail.

### 5.3 Membuat Service Order Baru

1. Buka halaman `/en/mektek`.
2. Pada bagian **Input Service Baru**, isi data berikut:
   - **Customer name**
   - **Vehicle**
   - **Phone**
   - **Estimated done** jika estimasi tanggal selesai sudah diketahui
   - **Address** jika alamat customer tersedia
3. Pada bagian service item, isi kerusakan atau pekerjaan servis.
4. Isi estimasi biaya pada field **Estimasi biaya (Rp)**.
5. Jika dibutuhkan, cari sparepart melalui field **Search catalog item...**.
6. Klik **Search**.
7. Jika item ditemukan, klik **Add** untuk memasukkan sparepart ke order.
8. Jika sparepart tidak ada di katalog, klik **Tambah sparepart** dan isi manual.
9. Klik tombol **Add Service**.

Hasil yang diharapkan:

- Muncul notifikasi **Service order created**.
- Service order baru muncul di daftar order.
- Sistem membuat **Customer tracking link**.
- Jika customer memiliki riwayat kunjungan selesai yang memenuhi tier loyalty, sistem menerapkan diskon otomatis.

Validasi data:

- Customer name, vehicle, dan complaint/service item wajib diisi.
- Phone wajib valid dan minimal memiliki jumlah digit yang memadai.
- Estimated done harus berupa tanggal valid.

### 5.4 Menyalin Customer Tracking Link

1. Setelah order berhasil dibuat, lihat bagian **Customer tracking link**.
2. Klik tombol **Copy Link**.
3. Bagikan link tersebut kepada customer melalui channel resmi, misalnya WhatsApp.

Hasil yang diharapkan:

- Link tersalin ke clipboard.
- Customer dapat membuka link dan melihat halaman progress servis.

### 5.5 Melihat Daftar Service Order

1. Buka halaman `/en/mektek`.
2. Periksa daftar order.
3. Gunakan filter tanggal:
   - **From date**
   - **To date**
4. Klik **Filter**.
5. Klik **Clear** untuk menghapus filter.
6. Gunakan pagination untuk pindah halaman.
7. Klik baris order untuk membuka detail order.

Informasi yang tersedia pada daftar:

- Nama customer
- Unit/vehicle
- Status order
- Due date
- Last updated
- Progress
- ID singkat order

### 5.6 Export Data Order ke Excel

1. Buka halaman `/en/mektek`.
2. Pastikan daftar order sudah sesuai dengan filter yang diinginkan.
3. Klik tombol export Excel yang tersedia pada halaman.
4. Periksa file hasil export.

Hasil yang diharapkan:

- File export berisi data order yang sedang tampil.
- Format data dapat digunakan untuk pelaporan internal.

### 5.7 Membuka Detail Service Order

1. Dari daftar order, klik salah satu order.
2. Pastikan halaman detail menampilkan:
   - Customer dan vehicle
   - Status
   - Progress
   - Customer & Service
   - Service & Sparepart
   - Work Timeline
   - Internal Notes
   - Loyalty/visit discount
   - Customer tracking link
   - Status control
   - Payment
   - Docs
   - WhatsApp

Hasil yang diharapkan:

- Detail order tampil lengkap.
- Informasi customer dan pekerjaan sesuai dengan data saat intake.

### 5.8 Mengelola Status Order

1. Buka detail service order.
2. Pada panel **Status**, pilih salah satu status:
   - **Pending**
   - **In Progress**
   - **Done**
3. Jika memilih **Done**, sistem menampilkan konfirmasi.
4. Tentukan apakah seluruh timeline juga akan ditandai selesai melalui opsi **Also mark all timeline steps as done**.
5. Klik **Confirm Done**.

Hasil yang diharapkan:

- Status order berubah sesuai pilihan.
- Progress order ikut berubah.
- Jika status menjadi Done, customer tracking juga menampilkan status selesai.

### 5.9 Menambah Timeline Pekerjaan

1. Buka detail service order.
2. Pada bagian **Work Timeline**, isi field timeline, contoh: `Sparepart sudah dipasang`.
3. Pilih status timeline:
   - **Done**
   - **Pending**
4. Jika tersedia, atur opsi notifikasi WhatsApp.
5. Klik **Add timeline**.

Hasil yang diharapkan:

- Timeline baru muncul di detail order.
- Customer tracking menampilkan update terbaru.
- Progress order diperbarui sesuai data timeline dan status order.

### 5.10 Mengelola Pembayaran

Fitur pembayaran hanya dapat diakses oleh Admin.

1. Buka detail service order.
2. Buka tab **Payment**.
3. Pilih metode pembayaran:
   - **Cash**
   - **Transfer**
   - **QRIS**
4. Isi nilai:
   - **Diskon**
   - **Pajak / biaya lain**
   - **Sudah dibayar**
5. Periksa ringkasan:
   - Subtotal servis
   - Subtotal sparepart
   - Total tagihan
   - Dibayar
   - Sisa bayar
6. Jika pembayaran sudah penuh, klik **Tandai Lunas**.
7. Klik **Simpan Pembayaran**.

Status pembayaran yang mungkin muncul:

- **Belum Bayar**
- **Dibayar Sebagian**
- **Lunas**

Hasil yang diharapkan:

- Data pembayaran tersimpan.
- Invoice dan struk customer menampilkan nilai pembayaran terbaru.
- Status pembayaran berubah sesuai jumlah yang dibayar.

### 5.11 Membuka Invoice dan Struk

1. Buka detail service order.
2. Buka tab **Docs**.
3. Gunakan action yang tersedia untuk melihat atau mengunduh invoice dan struk.
4. Periksa isi dokumen:
   - Data customer
   - Data order
   - Rincian service item
   - Rincian sparepart
   - Diskon
   - Pajak/biaya lain
   - Total tagihan
   - Status pembayaran

Hasil yang diharapkan:

- Invoice dapat dibuka.
- Struk dapat dibuka.
- Nilai dokumen sesuai dengan detail order dan pembayaran.

### 5.12 Menggunakan WhatsApp Composer

1. Buka detail service order.
2. Buka tab **WhatsApp**.
3. Pastikan nomor customer dan tracking link tersedia.
4. Susun pesan atau gunakan template yang tersedia.
5. Kirim pesan sesuai alur operasional yang berlaku.

Catatan:

- Ketersediaan pengiriman WhatsApp tergantung implementasi dan koneksi backend WhatsApp.
- Jika backend belum aktif, fitur dapat digunakan sebatas penyusunan template atau validasi tampilan.

### 5.13 Mengelola Katalog Sparepart

1. Buka halaman `/en/mektek/items`.
2. Gunakan filter:
   - Search description, machine, or part number
   - Machine
3. Klik **Filter**.
4. Klik **Clear** untuk menghapus filter.
5. Untuk menambah item, klik **Add item**.
6. Isi data katalog:
   - Machine
   - Excel row
   - Part number
   - Catalogue part number
   - Quantity
   - Price
   - Description
   - Illustration
   - Image path
   - Remark
7. Klik **Create item**.
8. Untuk mengubah item, klik **Edit**, ubah data, lalu klik **Save changes**.
9. Untuk menghapus item, klik tombol ikon hapus pada baris item.

Hasil yang diharapkan:

- Item baru dapat dicari di katalog admin.
- Item baru dapat dicari oleh customer di halaman katalog.
- Item dapat dipakai pada service intake sebagai sparepart.

### 5.14 Mengelola Halaman WhatsApp

1. Buka halaman `/en/mektek/whatsapp`.
2. Periksa **Status Sesi**:
   - Belum terhubung
   - Menghubungkan
   - Scan QR
   - Auth gagal
   - Terhubung
3. Jika QR code muncul, scan menggunakan WhatsApp pada ponsel pengirim.
4. Klik **Refresh Status** untuk memperbarui status.
5. Periksa bagian **Template Pesan**:
   - Order Baru
   - Update Status
   - Servis Selesai
6. Ubah isi template jika perlu untuk testing tampilan.

Catatan:

- Tombol **Simpan Template (Backend Pending)** dalam kondisi disabled.
- Fitur simpan template backend belum aktif pada halaman ini.

---

## 6. Panduan Penggunaan untuk CS

CS memiliki alur kerja yang mirip dengan Admin, tetapi tidak memiliki akses mengelola pembayaran.

### 6.1 Login sebagai CS

1. Buka `/sign-in`.
2. Login menggunakan email dan password akun CS.
3. Buka `/en/mektek`.

Hasil yang diharapkan:

- CS dapat melihat form **Input Service Baru**.
- CS dapat membuat service order.
- CS tidak melihat tab **Payment** pada detail order.

### 6.2 Membuat Order sebagai CS

Ikuti langkah pada bagian **5.3 Membuat Service Order Baru**.

Hasil yang harus diperiksa:

- Order berhasil dibuat.
- Customer tracking link muncul.
- Diskon loyalty otomatis muncul jika customer memenuhi syarat.
- CS dapat membuka detail order.
- CS dapat membuka tab **Docs** dan **WhatsApp**.
- CS tidak dapat mengubah pembayaran.

---

## 7. Panduan Penggunaan untuk Technician

Technician fokus pada update progress pekerjaan.

### 7.1 Login sebagai Technician

1. Buka `/sign-in`.
2. Login menggunakan akun Technician.
3. Buka `/en/mektek`.

Hasil yang diharapkan:

- Technician dapat mengakses workspace MekTek.
- Form pembuatan order tidak tampil.
- Sistem menampilkan pesan bahwa hanya Admin atau CS yang dapat menambah service record baru.

### 7.2 Update Progress Pekerjaan

1. Buka salah satu order dari daftar order.
2. Pada bagian **Work Timeline**, isi update pekerjaan.
3. Pilih status timeline **Done** atau **Pending**.
4. Klik **Add timeline**.
5. Pada panel **Status**, ubah status order bila diperlukan.

Hasil yang diharapkan:

- Timeline berhasil ditambahkan.
- Status order dapat diubah.
- Customer tracking menerima update terbaru.
- Technician tidak melihat tab **Payment** dan tidak melihat fitur pembayaran.

---

## 8. Panduan Penggunaan untuk Customer

Customer dapat menggunakan website tanpa login untuk melihat halaman informasi dan katalog. Untuk melihat profile servis berdasarkan nomor telepon, customer perlu membuat akun atau login.

### 8.1 Membuka Customer Home

1. Buka halaman `/en/customer`.
2. Baca informasi layanan MekTek.
3. Klik **Buka katalog** untuk masuk ke katalog sparepart.
4. Klik **Cek service profile** untuk masuk ke profile customer.

Hasil yang diharapkan:

- Halaman informasi MekTek tampil.
- Customer dapat melanjutkan ke katalog atau profile.

### 8.2 Mencari Sparepart di Katalog Customer

1. Buka halaman `/en/customer?view=sparepart`.
2. Isi field pencarian berdasarkan:
   - Part number
   - Item name
   - Description
3. Jika perlu, isi field **Machine**.
4. Klik **Search**.
5. Periksa hasil katalog.
6. Gunakan tombol **Previous** dan **Next** untuk pindah halaman.
7. Klik **Clear filters** untuk menghapus filter.

Informasi item yang tampil:

- Gambar item jika tersedia
- Machine
- Row
- Deskripsi item
- Part number atau catalogue part number
- Remark jika tersedia
- Harga atau informasi **Hubungi admin** jika harga belum tersedia

### 8.3 Membuat Akun Customer

1. Buka `/register`.
2. Pilih tab **Customer**.
3. Isi:
   - Name
   - Phone number
   - Password
   - Confirm Password
4. Klik **Create customer account**.

Hasil yang diharapkan:

- Akun customer dibuat.
- Customer otomatis login jika kredensial valid.
- Customer diarahkan ke `/customer/profile`.

Validasi:

- Nomor telepon wajib valid.
- Password minimal 8 karakter.
- Password dan confirm password harus sama.
- Nomor telepon tidak boleh sudah dipakai akun lain.

### 8.4 Login sebagai Customer

1. Buka `/sign-in`.
2. Isi **E-mail or phone number** dengan nomor telepon customer.
3. Isi password.
4. Klik **Login**.

Hasil yang diharapkan:

- Customer berhasil login.
- Jika login menggunakan nomor telepon, customer diarahkan ke `/customer/profile`.

### 8.5 Melihat Customer Profile

1. Login sebagai customer.
2. Buka `/en/customer/profile`.
3. Periksa kartu informasi:
   - Name
   - Phone
   - Services
4. Periksa daftar service order yang terhubung dengan nomor telepon customer.
5. Buka invoice, struk, atau public tracking link jika tersedia.

Hasil yang diharapkan:

- Customer hanya melihat service order miliknya.
- Jika nomor telepon customer belum terhubung ke service order, sistem menampilkan informasi bahwa belum ada service terkait.
- Jika session bukan akun berbasis nomor telepon, sistem menampilkan pesan bahwa customer perlu sign in dengan nomor telepon.

### 8.6 Melihat Status Servis Melalui Tracking Link

1. Buka link tracking yang diberikan admin/CS, misalnya `/en/s/{code}`.
2. Periksa halaman **MEKTEK Service Progress**.
3. Validasi informasi:
   - Service ID
   - Vehicle
   - ETA
   - Progress
   - Status
   - Invoice & Struk
   - Progress Track
   - Latest Update
   - Service Notes
4. Klik **Lihat Invoice** untuk membuka invoice.
5. Klik **Download** untuk mengunduh invoice.
6. Klik **Lihat Struk** untuk membuka struk.
7. Klik **Download** untuk mengunduh struk.

Hasil yang diharapkan:

- Customer dapat melihat progress terbaru.
- Update timeline dari admin/technician tampil di halaman customer.
- Invoice dan struk sesuai data pembayaran.
- Link bersifat privat dan hanya membuka satu service order terkait.

---

## 9. Fitur Utama Aplikasi

### 9.1 Authentication

Fitur:

- Login menggunakan email atau nomor telepon.
- Login OAuth Google/GitHub jika provider dikonfigurasi.
- Register customer.
- Register staff.
- Reset password melalui email.

Poin testing:

- Login berhasil dengan kredensial valid.
- Login gagal dengan password salah.
- Customer dapat login menggunakan nomor telepon.
- Staff baru berstatus pending kecuali pada kondisi environment tertentu.

### 9.2 Dashboard MekTek

Fitur:

- Ringkasan jumlah open orders.
- Jumlah order due today.
- Jumlah overdue.
- Jumlah completed today.
- Total unpaid balance.
- Recent orders dengan pagination.

Poin testing:

- Dashboard hanya bisa diakses role staff MekTek yang valid.
- Angka ringkasan berubah sesuai data order.
- Recent order dapat dibuka.

### 9.3 Service Intake

Fitur:

- Input customer, vehicle, phone, address, dan estimated done.
- Input service items.
- Input sparepart items manual.
- Cari dan tambahkan sparepart dari katalog.
- Generate customer tracking link.
- Simpan data customer berdasarkan phoneNormalized.
- Terapkan diskon loyalty otomatis.

Poin testing:

- Field wajib divalidasi.
- Order tersimpan dengan status awal Active.
- Timeline awal dibuat otomatis.
- Tracking link berbentuk short link `/s/{code}`.
- Katalog dapat menambah item ke sparepart order.

### 9.4 Detail Service Order

Fitur:

- Ringkasan customer dan vehicle.
- Badge status.
- Progress bar.
- Detail customer dan service.
- Rincian service item dan sparepart item.
- Timeline pekerjaan.
- Internal notes.
- Visit discount card.
- Customer tracking link.
- Status control.
- Payment.
- Docs.
- WhatsApp.

Poin testing:

- Data detail sama dengan data yang dibuat saat intake.
- Progress berubah saat timeline/status berubah.
- Hak akses tab sesuai role.

### 9.5 Timeline dan Status

Fitur:

- Tambah timeline dengan status Done/Pending.
- Ubah order status menjadi Pending, In Progress, atau Done.
- Saat Done, semua timeline dapat ditandai selesai sekaligus.

Poin testing:

- Admin dan Technician dapat menambah timeline.
- CS tidak memiliki fitur update progress jika mengikuti permission saat ini.
- Customer tracking menerima update terbaru.

### 9.6 Payment

Fitur:

- Pilih metode Cash, Transfer, atau QRIS.
- Isi diskon.
- Isi pajak/biaya lain.
- Isi jumlah dibayar.
- Tandai lunas.
- Hitung total tagihan dan sisa bayar.

Poin testing:

- Hanya Admin dapat mengakses Payment.
- Status pembayaran berubah menjadi Belum Bayar, Dibayar Sebagian, atau Lunas.
- Nilai invoice dan struk mengikuti data pembayaran terbaru.

### 9.7 Invoice dan Struk

Fitur:

- Lihat invoice.
- Download invoice.
- Lihat struk.
- Download struk.
- Customer juga dapat mengakses invoice dan struk melalui tracking link.

Poin testing:

- Dokumen dapat dibuka tanpa error.
- Dokumen customer membutuhkan token/link yang valid.
- Nilai dokumen konsisten dengan detail order.

### 9.8 Katalog Sparepart

Fitur:

- Admin/CS membuat item katalog.
- Admin/CS mengubah item katalog.
- Admin/CS menghapus item katalog.
- Customer mencari katalog.
- Item katalog dapat ditambahkan ke service order.

Poin testing:

- Search berdasarkan deskripsi, machine, part number, catalogue part number, atau remark.
- Item baru muncul di halaman customer.
- Harga tampil dalam format IDR.
- Item tanpa harga menampilkan pesan untuk menghubungi admin.

### 9.9 Customer Tracking

Fitur:

- Short link `/s/{code}`.
- Token link `/service-status/{id}?token={token}`.
- Live update menggunakan stream API.
- Menampilkan invoice dan struk.

Poin testing:

- Link tanpa token valid tidak dapat membuka data.
- Link valid menampilkan data order yang benar.
- Update timeline muncul pada halaman customer tanpa reload manual jika stream aktif.

### 9.10 Loyalty Discount

Fitur:

- Sistem menghitung jumlah kunjungan selesai customer.
- Diskon otomatis diterapkan saat service order baru dibuat.

Tier yang berlaku:

| Jumlah kunjungan selesai | Tier | Diskon |
| --- | --- | --- |
| 1 atau lebih | Member | 0% |
| 3 atau lebih | Silver | 5% |
| 6 atau lebih | Gold | 10% |
| 11 atau lebih | Platinum | 15% |

Poin testing:

- Customer dengan 3 completed orders mendapat Silver 5%.
- Diskon dihitung dari subtotal service dan sparepart.
- Diskon tersimpan pada order dan muncul pada pembayaran/invoice.

### 9.11 WhatsApp

Fitur:

- Menampilkan status session WhatsApp.
- Menampilkan QR code jika session membutuhkan pairing.
- Menampilkan nomor pengirim setelah terhubung.
- Menyediakan template pesan:
  - Order Baru
  - Update Status
  - Servis Selesai

Poin testing:

- Status session berubah sesuai response API.
- QR code tampil ketika tersedia.
- Template dapat diedit di UI.
- Tombol simpan template masih disabled karena backend pending.

---

## 10. Skenario Testing Manual

### TC-001 Login Admin Berhasil

**Tujuan:** Memastikan Admin dapat masuk ke aplikasi.  
**Langkah:**

1. Buka `/sign-in`.
2. Isi email admin.
3. Isi password admin.
4. Klik **Login**.

**Expected result:**

- Login sukses.
- User diarahkan ke halaman aplikasi.
- Admin dapat membuka `/en/mektek/dashboard`.

### TC-002 Login Gagal

**Tujuan:** Memastikan sistem menolak kredensial salah.  
**Langkah:**

1. Buka `/sign-in`.
2. Isi email atau nomor telepon yang tidak valid.
3. Isi password salah.
4. Klik **Login**.

**Expected result:**

- Sistem menampilkan error atau tetap berada di halaman login.
- User tidak mendapatkan akses ke halaman MekTek.

### TC-003 Admin Melihat Dashboard

**Tujuan:** Memastikan dashboard operasional tampil.  
**Langkah:**

1. Login sebagai Admin.
2. Buka `/en/mektek/dashboard`.

**Expected result:**

- Heading **MEKTEK Dashboard** tampil.
- Kartu Open orders, Due today, Overdue, Completed today, dan Unpaid balance tampil.
- Recent orders tampil atau menampilkan empty state.

### TC-004 CS Membuat Service Order Baru

**Tujuan:** Memastikan CS dapat membuat order.  
**Langkah:**

1. Login sebagai CS.
2. Buka `/en/mektek`.
3. Isi data customer, vehicle, phone, service item, dan biaya.
4. Klik **Add Service**.

**Expected result:**

- Muncul notifikasi **Service order created**.
- Order baru tampil di daftar.
- Customer tracking link muncul.
- CS dapat membuka detail order.

### TC-005 Technician Tidak Dapat Membuat Order

**Tujuan:** Memastikan permission Technician sesuai.  
**Langkah:**

1. Login sebagai Technician.
2. Buka `/en/mektek`.

**Expected result:**

- Form pembuatan order tidak tampil.
- Muncul pesan bahwa hanya Admin atau CS yang dapat menambah service record baru.

### TC-006 Technician Menambah Timeline

**Tujuan:** Memastikan Technician dapat update progress.  
**Langkah:**

1. Login sebagai Technician.
2. Buka detail service order.
3. Isi timeline baru.
4. Pilih Done atau Pending.
5. Klik **Add timeline**.

**Expected result:**

- Timeline baru tampil.
- Progress customer tracking ikut berubah.

### TC-007 Admin Mengubah Status menjadi Done

**Tujuan:** Memastikan order dapat diselesaikan.  
**Langkah:**

1. Login sebagai Admin.
2. Buka detail service order.
3. Pada panel Status, klik **Done**.
4. Centang atau hapus centang opsi mark all timeline sesuai kebutuhan.
5. Klik **Confirm Done**.

**Expected result:**

- Status order berubah menjadi Done.
- Jika opsi mark all timeline aktif, semua timeline menjadi Done.
- Customer tracking menampilkan status selesai.

### TC-008 Admin Mengelola Pembayaran Lunas

**Tujuan:** Memastikan pembayaran dapat disimpan dan status lunas tampil.  
**Langkah:**

1. Login sebagai Admin.
2. Buka detail service order.
3. Buka tab Payment.
4. Pilih metode pembayaran.
5. Klik **Tandai Lunas**.
6. Klik **Simpan Pembayaran**.

**Expected result:**

- Status pembayaran menjadi **Lunas**.
- Total dibayar sama dengan total tagihan.
- Sisa bayar menjadi 0.

### TC-009 CS Tidak Dapat Mengelola Pembayaran

**Tujuan:** Memastikan fitur pembayaran hanya untuk Admin.  
**Langkah:**

1. Login sebagai CS.
2. Buka detail service order.

**Expected result:**

- Tab Payment tidak tampil.
- CS tetap dapat melihat Docs dan WhatsApp.

### TC-010 Customer Membuka Tracking Link

**Tujuan:** Memastikan customer dapat melihat progress melalui link.  
**Langkah:**

1. Ambil customer tracking link dari order.
2. Buka link pada browser lain atau incognito.

**Expected result:**

- Halaman **MEKTEK Service Progress** tampil.
- Customer melihat vehicle, ETA, progress, invoice, struk, dan progress track.

### TC-011 Customer Tracking Menerima Live Update

**Tujuan:** Memastikan update timeline tampil di customer tracking.  
**Langkah:**

1. Buka tracking link customer.
2. Di browser lain, login sebagai Admin atau Technician.
3. Tambahkan timeline baru pada order yang sama.
4. Periksa halaman customer.

**Expected result:**

- Update timeline baru tampil pada halaman customer.
- Tidak ada error console terkait stream.

### TC-012 Customer Melihat Invoice dan Struk

**Tujuan:** Memastikan dokumen dapat dibuka dari tracking page.  
**Langkah:**

1. Buka tracking link customer.
2. Klik **Lihat Invoice**.
3. Klik **Download** invoice.
4. Klik **Lihat Struk**.
5. Klik **Download** struk.

**Expected result:**

- Invoice dapat dibuka dan diunduh.
- Struk dapat dibuka dan diunduh.
- Nilai dokumen sesuai pembayaran.

### TC-013 Admin Mengelola Katalog

**Tujuan:** Memastikan item katalog dapat dibuat, diedit, dicari, dan dihapus.  
**Langkah:**

1. Login sebagai Admin atau CS.
2. Buka `/en/mektek/items`.
3. Klik **Add item**.
4. Isi machine dan description minimal.
5. Isi part number dan price jika tersedia.
6. Klik **Create item**.
7. Cari item yang baru dibuat.
8. Klik **Edit**, ubah description, lalu simpan.
9. Hapus item jika testing selesai.

**Expected result:**

- Item berhasil dibuat.
- Item dapat dicari.
- Update item tersimpan.
- Item dapat dihapus.

### TC-014 Customer Mencari Katalog

**Tujuan:** Memastikan customer dapat mencari sparepart.  
**Langkah:**

1. Buka `/en/customer?view=sparepart`.
2. Cari item berdasarkan description atau part number.
3. Gunakan filter machine.

**Expected result:**

- Hasil pencarian sesuai keyword.
- Harga tampil sebagai IDR atau **Hubungi admin**.
- Pagination berfungsi.

### TC-015 Loyalty Discount Otomatis

**Tujuan:** Memastikan diskon loyalty diterapkan berdasarkan riwayat kunjungan selesai.  
**Langkah:**

1. Siapkan customer dengan minimal 3 completed service orders.
2. Login sebagai Admin atau CS.
3. Buat service order baru untuk nomor telepon customer tersebut.
4. Isi subtotal service/sparepart.
5. Simpan order.

**Expected result:**

- Sistem menampilkan **Silver discount applied automatically: 5%**.
- Discount tersimpan pada order.
- Invoice/payment memperhitungkan diskon tersebut.

### TC-016 Register Customer

**Tujuan:** Memastikan customer dapat membuat akun.  
**Langkah:**

1. Buka `/register`.
2. Pilih tab Customer.
3. Isi nama, nomor telepon, password, dan confirm password.
4. Klik **Create customer account**.

**Expected result:**

- Akun customer dibuat.
- Customer diarahkan ke profile.
- Jika nomor telepon pernah dipakai order, service terkait muncul otomatis.

### TC-017 Customer Profile Tanpa Service

**Tujuan:** Memastikan customer tanpa order mendapatkan empty state yang jelas.  
**Langkah:**

1. Register customer baru dengan nomor telepon yang belum pernah dipakai order.
2. Buka `/en/customer/profile`.

**Expected result:**

- Profile terbuka.
- Sistem menampilkan pesan bahwa belum ada service yang terhubung.

### TC-018 WhatsApp Status Page

**Tujuan:** Memastikan halaman WhatsApp dapat menampilkan status session dan template.  
**Langkah:**

1. Login sebagai user yang memiliki akses.
2. Buka `/en/mektek/whatsapp`.
3. Periksa status session.
4. Jika QR tersedia, periksa QR code.
5. Edit template pesan.

**Expected result:**

- Status session tampil.
- QR code tampil jika API mengembalikan QR.
- Template dapat diedit pada UI.
- Tombol simpan template masih disabled.

---

## 11. Checklist UAT Ringkas

Gunakan checklist berikut saat melakukan UAT:

| Area | Checklist | Status |
| --- | --- | --- |
| Login | Admin dapat login |  |
| Login | CS dapat login |  |
| Login | Technician dapat login |  |
| Login | Customer dapat login dengan nomor telepon |  |
| Permission | Technician tidak dapat membuat order |  |
| Permission | CS tidak dapat mengubah pembayaran |  |
| Dashboard | Dashboard menampilkan semua kartu ringkasan |  |
| Order | Admin/CS dapat membuat service order |  |
| Order | Order muncul di daftar dan detail |  |
| Order | Filter tanggal berjalan |  |
| Order | Pagination berjalan |  |
| Katalog | Admin/CS dapat membuat item katalog |  |
| Katalog | Customer dapat mencari item katalog |  |
| Timeline | Admin/Technician dapat menambah timeline |  |
| Status | Admin/Technician dapat mengubah status order |  |
| Payment | Admin dapat menyimpan pembayaran |  |
| Docs | Invoice dapat dibuka |  |
| Docs | Struk dapat dibuka |  |
| Customer | Tracking link dapat dibuka |  |
| Customer | Customer profile menampilkan service terkait |  |
| Loyalty | Diskon otomatis sesuai riwayat customer |  |
| WhatsApp | Status session WhatsApp tampil |  |

---

## 12. Checklist Regression Testing

Regression testing dilakukan setiap ada perubahan pada fitur MekTek.

1. Jalankan validasi Prisma:

```bash
pnpm exec prisma validate
```

2. Jalankan unit test:

```bash
pnpm test
```

3. Jalankan end-to-end test:

```bash
pnpm test:e2e
```

4. Jika ingin menjalankan test tertentu:

```bash
pnpm exec playwright test tests/e2e/auth.spec.ts
pnpm exec playwright test tests/e2e/mektek-roles-dashboard.spec.ts
pnpm exec playwright test tests/e2e/mektek-live-tracking.spec.ts
pnpm exec playwright test tests/e2e/mektek-dashboard-loyalty.spec.ts
```

5. Periksa skenario utama:
   - Authentication
   - Role permission
   - Dashboard
   - Service intake
   - Timeline/status
   - Customer tracking
   - Payment
   - Invoice/receipt
   - Catalogue item
   - Loyalty discount

---

## 13. Data Testing yang Disarankan

Gunakan data unik setiap kali testing agar tidak bentrok dengan data sebelumnya.

Contoh format:

| Field | Contoh |
| --- | --- |
| Customer name | `UAT Customer 2026-001` |
| Phone | `+6281200000001` |
| Vehicle | `Excavator UAT 001` |
| Service item | `Pemeriksaan sistem hidrolik` |
| Service cost | `200000` |
| Sparepart manual | `Filter oli UAT` |
| Sparepart cost | `50000` |
| Machine | `MACHINE-UAT-001` |
| Part number | `PART-UAT-001` |
| Catalogue description | `Brake pad UAT testing item` |

Prinsip data testing:

- Jangan gunakan nomor telepon customer asli kecuali testing produksi memang disetujui.
- Gunakan prefix seperti `UAT`, `TEST`, atau tanggal testing pada nama customer dan item katalog.
- Hapus data katalog dummy setelah testing jika tidak dibutuhkan.
- Simpan customer tracking link yang dipakai untuk bukti testing.

---

## 14. Kriteria Kelulusan UAT

Testing dinyatakan lulus jika:

1. Setiap role hanya dapat mengakses fitur sesuai permission.
2. Admin/CS dapat membuat service order end-to-end.
3. Technician dapat memperbarui progress tanpa akses pembayaran.
4. Customer dapat melihat tracking link dan customer profile.
5. Payment, invoice, dan struk menampilkan nilai yang konsisten.
6. Katalog dapat dikelola oleh Admin/CS dan dapat dicari oleh customer.
7. Loyalty discount otomatis berjalan sesuai tier.
8. Tidak ada error kritis pada browser console selama alur utama.
9. Automated test utama lulus atau seluruh kegagalan sudah terdokumentasi dan disetujui.

---

## 15. Template Laporan Hasil Testing

Gunakan format berikut untuk pelaporan:

```text
Nama tester:
Tanggal testing:
Environment:
Browser:
Role yang diuji:

Ringkasan hasil:
- Total test case:
- Passed:
- Failed:
- Blocked:

Daftar issue:
1. ID test case:
   Deskripsi masalah:
   Langkah reproduksi:
   Expected result:
   Actual result:
   Screenshot/link bukti:
   Severity:
   PIC:

Catatan tambahan:
```

Severity yang disarankan:

| Severity | Definisi |
| --- | --- |
| Critical | Fitur utama tidak dapat digunakan sama sekali atau data penting salah. |
| High | Alur penting terganggu tetapi masih ada workaround terbatas. |
| Medium | Fungsi berjalan tetapi ada kesalahan non-kritis atau pengalaman pengguna terganggu. |
| Low | Masalah minor pada teks, tampilan, atau konsistensi kecil. |

---

## 16. Catatan Operasional

1. Nomor telepon adalah kunci penting untuk menghubungkan customer dengan service order.
2. Customer tracking link bersifat privat dan tidak boleh disebarkan ke pihak yang tidak berkepentingan.
3. Perubahan status menjadi Done perlu dilakukan hanya ketika pekerjaan benar-benar selesai.
4. Pembayaran harus disimpan oleh Admin sebelum invoice/struk dijadikan dokumen final.
5. Data katalog yang salah akan memengaruhi service intake dan tampilan customer.
6. Jika WhatsApp belum terhubung, kirim tracking link secara manual melalui channel yang disetujui.
7. Jika ada perubahan permission atau role, dokumen ini perlu diperbarui.

