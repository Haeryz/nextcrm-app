import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffDivision } from "@/lib/auth/staff-divisions";

export const STAFF_CAPABILITIES = [
  "MEKTEK_CUSTOMER_SERVICE",
  "MEKTEK_CATALOG",
  "MEKTEK_MONITORING_PO",
  "MEKTEK_RECEIVING",
  "MEKTEK_FINANCE",
  "MEKTEK_ACCOUNTING",
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export const STAFF_CAPABILITY_LABELS: Record<StaffCapability, string> = {
  MEKTEK_CUSTOMER_SERVICE: "Customer Service",
  MEKTEK_CATALOG: "Catalog / Item",
  MEKTEK_MONITORING_PO: "Monitoring PO",
  MEKTEK_RECEIVING: "Receiving",
  MEKTEK_FINANCE: "Finance",
  MEKTEK_ACCOUNTING: "Accounting",
};

export const STAFF_CAPABILITY_DESCRIPTIONS: Record<StaffCapability, string> = {
  MEKTEK_CUSTOMER_SERVICE:
    "Dashboard, Service Order, Buat Service Order, Update Progress, Pembayaran, Jadwal, Customer Tools & WhatsApp, Customer, dan Voucher",
  MEKTEK_CATALOG: "Kelola Catalog / Item dan stok",
  MEKTEK_MONITORING_PO: "Kelola pengiriman Monitoring PO",
  MEKTEK_RECEIVING: "Kelola penerimaan barang Receiving",
  MEKTEK_FINANCE: "Pembayaran Pemasok dan Laporan Hutang Pemasok",
  MEKTEK_ACCOUNTING:
    "Ringkasan, Rekap Invoice, Rekap Surat Jalan, Rekapitulasi Invoice Jasa & Part, Pendapatan Spare Part, Pendapatan Jasa, Rekap Jasa & Part, Kontrak, Audit Sistem, dan Payment Faktur",
};

// Broad capability set granted to every non-Logistics, non-Finance division before
// the capability migration. Used only by the backfill so existing sub-admins keep
// exactly the access `isBroadDivisionStaff` gave them; admins narrow it later.
// After the simplification, the nine customer-service capabilities collapsed into
// the single MEKTEK_CUSTOMER_SERVICE bundle, so the broad set is that one bundle.
export const BROAD_LEGACY_CAPABILITIES: StaffCapability[] = [
  "MEKTEK_CUSTOMER_SERVICE",
];

export function isStaffCapability(value: unknown): value is StaffCapability {
  return (
    typeof value === "string" &&
    (STAFF_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function normalizeStaffCapabilities(
  values: readonly unknown[],
): StaffCapability[] {
  const seen = new Set<StaffCapability>();
  for (const value of values) {
    if (isStaffCapability(value) && !seen.has(value)) seen.add(value);
  }
  return Array.from(seen);
}

export function capabilitiesForLegacyDivision(
  division: StaffDivision | null,
  logisticsArea: LogisticsStaffArea | null,
): StaffCapability[] {
  if (!division) return [];
  if (division === "LOGISTICS") {
    if (logisticsArea === "MONITORING_PO") {
      return ["MEKTEK_CATALOG", "MEKTEK_MONITORING_PO"];
    }
    if (logisticsArea === "RECEIVING") {
      return ["MEKTEK_CATALOG", "MEKTEK_RECEIVING"];
    }
    // Logistics without an area (legacy/inconsistent): grant Catalog only, the
    // common denominator, so they can still sign in. Admin reassigns via UI.
    return ["MEKTEK_CATALOG"];
  }
  if (division === "FINANCE") {
    // Finance staff keep the financial workspace; Accounting is granted alongside
    // MEKTEK_FINANCE so the Finance/Accounting split causes no access loss.
    return ["MEKTEK_FINANCE", "MEKTEK_ACCOUNTING"];
  }
  return [...BROAD_LEGACY_CAPABILITIES];
}
