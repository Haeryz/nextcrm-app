import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffDivision } from "@/lib/auth/staff-divisions";

export const STAFF_CAPABILITIES = [
  "MEKTEK_DASHBOARD",
  "MEKTEK_SERVICE_ORDERS",
  "MEKTEK_CREATE_ORDERS",
  "MEKTEK_UPDATE_PROGRESS",
  "MEKTEK_MANAGE_PAYMENTS",
  "MEKTEK_MANAGE_SCHEDULE",
  "MEKTEK_CUSTOMER_TOOLS",
  "MEKTEK_CUSTOMERS",
  "MEKTEK_CATALOG",
  "MEKTEK_MONITORING_PO",
  "MEKTEK_RECEIVING",
  "MEKTEK_FINANCE",
  "MEKTEK_VOUCHERS",
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export const STAFF_CAPABILITY_LABELS: Record<StaffCapability, string> = {
  MEKTEK_DASHBOARD: "Dashboard",
  MEKTEK_SERVICE_ORDERS: "Service Order",
  MEKTEK_CREATE_ORDERS: "Buat Service Order",
  MEKTEK_UPDATE_PROGRESS: "Update Progress",
  MEKTEK_MANAGE_PAYMENTS: "Pembayaran",
  MEKTEK_MANAGE_SCHEDULE: "Jadwal",
  MEKTEK_CUSTOMER_TOOLS: "Customer Tools & WhatsApp",
  MEKTEK_CUSTOMERS: "Customer",
  MEKTEK_CATALOG: "Catalog / Item",
  MEKTEK_MONITORING_PO: "Monitoring PO",
  MEKTEK_RECEIVING: "Receiving",
  MEKTEK_FINANCE: "Finance",
  MEKTEK_VOUCHERS: "Voucher",
};

export const STAFF_CAPABILITY_DESCRIPTIONS: Record<StaffCapability, string> = {
  MEKTEK_DASHBOARD: "Ringkasan dashboard Mektek",
  MEKTEK_SERVICE_ORDERS: "Lihat daftar dan detail Service Order",
  MEKTEK_CREATE_ORDERS: "Buat Service Order dan kelola item order",
  MEKTEK_UPDATE_PROGRESS: "Catat progress pengerjaan Service Order",
  MEKTEK_MANAGE_PAYMENTS: "Kelola pembayaran Service Order",
  MEKTEK_MANAGE_SCHEDULE: "Atur jadwal Service Order",
  MEKTEK_CUSTOMER_TOOLS: "Akses Customer Tools, WhatsApp, dan Email",
  MEKTEK_CUSTOMERS: "Kelola data Customer",
  MEKTEK_CATALOG: "Kelola Catalog / Item dan stok",
  MEKTEK_MONITORING_PO: "Kelola pengiriman Monitoring PO",
  MEKTEK_RECEIVING: "Kelola penerimaan barang Receiving",
  MEKTEK_FINANCE: "Kelola Finance, Faktur, dan laporan keuangan",
  MEKTEK_VOUCHERS: "Kelola Voucher",
};

// Broad capability set granted to every non-Logistics division before the
// capability migration. Used only by the backfill so existing sub-admins keep
// exactly the access `isBroadDivisionStaff` gave them; admins narrow it later.
export const BROAD_LEGACY_CAPABILITIES: StaffCapability[] = [
  "MEKTEK_DASHBOARD",
  "MEKTEK_SERVICE_ORDERS",
  "MEKTEK_CREATE_ORDERS",
  "MEKTEK_UPDATE_PROGRESS",
  "MEKTEK_MANAGE_PAYMENTS",
  "MEKTEK_MANAGE_SCHEDULE",
  "MEKTEK_CUSTOMER_TOOLS",
  "MEKTEK_CUSTOMERS",
  "MEKTEK_CATALOG",
  "MEKTEK_VOUCHERS",
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
    return [...BROAD_LEGACY_CAPABILITIES, "MEKTEK_FINANCE"];
  }
  return [...BROAD_LEGACY_CAPABILITIES];
}
