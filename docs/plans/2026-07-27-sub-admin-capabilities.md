# Plan — Sub-admin Capability-based Authorization

Tanggal: 2026-07-27
Status: Dikonfirmasi — siap dieksekusi

## Tujuan

Sub-admin bisa dibuat agar hanya boleh mengakses **beberapa page** (satu, beberapa,
atau semua area Mektek). Mengganti model division+area tunggal dengan **set capability
granular** sesuai `docs/staff-authorization.md` langkah 1–7.

## Keputusan (konfirmasi user)

- Model: **Set capability granular** (`staffCapabilities String[]` di Users).
- Cakupan: **matriks lengkap semua area Mektek**.
- Backward compat: **backfill dari staffDivision/logisticsStaffArea, pertahankan kolom lama**.
- `Users.is_admin` tetap unconditional allow (owner key).
- `Users.mektekRole` (CS/TECHNICIAN) tetap kompat (tidak digabung diam-diam).
- Staff management (`/mektek/staff`) & technicians (`/mektek/technicians`) tetap
  **main-admin-only** (`requireAdmin`), bukan capability.

## Matriks Capability (canonical — simplified 2026-07-27)

File: `lib/auth/staff-capabilities.ts`

| Capability | Page / route | Catatan |
|---|---|---|
| `MEKTEK_CUSTOMER_SERVICE` | `/mektek/dashboard`, `/mektek` (orders + create + update progress), `/mektek/whatsapp`, `/mektek/email`, `/mektek/customers`, `/mektek/vouchers`, pembayaran, jadwal | Bundle 9 kapabilitas lama (Dashboard, Service Order, Buat, Update Progress, Pembayaran, Jadwal, Customer Tools & WA, Customer, Voucher) |
| `MEKTEK_CATALOG` | `/mektek/items`, `/mektek/items/spreadsheet` | |
| `MEKTEK_MONITORING_PO` | `/mektek/logistics`, `/mektek/logistics/spreadsheet` | |
| `MEKTEK_RECEIVING` | `/mektek/receiving`, `/mektek/receiving/spreadsheet`, `/mektek/receiving/pics` | |
| `MEKTEK_FINANCE` | `/mektek/finance/payables`, `/mektek/finance/payables/sources/[sourceId]`, `/mektek/finance/supplier-debt-report`, finance actions/routes (pembayaran pemasok, hutang pemasok) | Dipecah dari Finance lama: hanya Pembayaran Pemasok + Laporan Hutang Pemasok |
| `MEKTEK_ACCOUNTING` | `/mektek/finance` (Ringkasan), `/mektek/finance/invoices`, `/mektek/finance/delivery-notes`, `/mektek/finance/receivables`, `/mektek/finance/spare-parts`, `/mektek/finance/services`, `/mektek/finance/revenue`, `/mektek/finance/contracts`, `/mektek/finance/audit`, `/mektek/finance/payment-faktur` | Baru: Ringkasan, Rekap Invoice/SJ, Pendapatan, Kontrak, Audit, Payment Faktur |

## Backfill (preserve existing access, no loss)

`capabilitiesForLegacyDivision(division, logisticsArea)`:

- `LOGISTICS` + `MONITORING_PO` → `[MEKTEK_CATALOG, MEKTEK_MONITORING_PO]`
- `LOGISTICS` + `RECEIVING` → `[MEKTEK_CATALOG, MEKTEK_RECEIVING]`
- `LOGISTICS` (null area) → `[MEKTEK_CATALOG]`
- `FINANCE` → `[MEKTEK_FINANCE, MEKTEK_ACCOUNTING]` (tidak ada akses yang hilang)
- `OPERATIONS` / `CUSTOMER_SERVICE` / `TECHNICAL` / `HUMAN_RESOURCES` → `[MEKTEK_CUSTOMER_SERVICE]`

Broad set = `[MEKTEK_CUSTOMER_SERVICE]` (9 kapabilitas granular lama di-collapse
menjadi 1 bundle). Admin bisa campur kapabilitas via UI checkbox.

## Perubahan

### Data
- `prisma/schema.prisma`: enum `StaffCapability` + `Users.staffCapabilities StaffCapability[] @default([])`.
- Migration `<ts>_staff_capabilities` dengan backfill SQL `CASE`.

### Session/JWT (role changes take effect from current DB — doc langkah 5)
- `types/next-auth.d.ts`: `staffCapabilities?: StaffCapability[]` di JWT + Session.
- `lib/auth.ts`: token + session callback (fetch fresh dari DB).
- `lib/session.ts`: `SessionUserLike` + toSession + normalizeSession + getFallbackUser select.
- `lib/request-session.ts`: return `staffCapabilities`.

### Enforcement seam (doc langkah 3–4)
- `lib/mektek/permissions.ts`: refactor tiap `canX` → `hasCapability(user, CAP)`.
  Pertahankan fallback `mektekRole` (CS/TECHNICIAN). `canAccessMektekStaffArea` →
  `isAdmin || staffCapabilities.length > 0 || mektekRole`. Hapus `isBroadDivisionStaff`
  broad-access branch (diganti capability). `isAdmin` tetap unconditional allow.

### CRUD + UI (doc langkah 7)
- `actions/auth/sub-admins.ts`: terima `staffCapabilities[]` (validasi via
  `isStaffCapability`), persist. Pertahankan `staffDivision`/`logisticsStaffArea`
  sebagai metadata (opsional, untuk display). `requireAdmin()` + `is_admin: false`
  predicate tetap.
- `app/[locale]/(routes)/mektek/staff/page.tsx` + komponen baru
  `StaffCapabilityFields.tsx`: **checkboxes** capability (multi-select). Ganti
  `StaffDivisionFields` (pertahankan untuk metadata opsional atau drop dari form).
- Hapus warning "matriks pembatasan divisi lain masih dalam tahap penyusunan".

### Defense-in-depth (doc langkah 5)
- `proxy.ts`: untuk path `/api/mektek/**`, decode JWT, cek `staffCapabilities`
  mengandung capability yang dipetakan ke route (best-effort, JWT bisa stale —
  server action/route handler tetap source of truth).

### Post-login redirect
- `lib/mektek/post-login-destination.ts`: redirect ke area pertama yang
  diizinkan (capability-based), bukan division-based.

## Tes (doc langkah 6)

File baru: `__tests__/mektek/staff-capabilities.test.ts`
- Denial: sub-admin tanpa capability tertentu ditolak di `canX`.
- Positive: `isAdmin` lolos semua; sub-admin dgn capability lolos yg relevan.
- Backfill mapping benar untuk setiap division+area.
- `sub-admins.ts` menerima & validasi `staffCapabilities`.
- `StaffCapabilityFields` merender semua capability.

## Out of scope

- Drop kolom `staffDivision`/`logisticsStaffArea` (dipertahankan).
- Audit log perubahan capability (follow-up).
- Granular data-scope (row-level) — capability dulu, scope data nanti.
