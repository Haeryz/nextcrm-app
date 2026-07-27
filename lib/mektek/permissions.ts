import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffCapability } from "@/lib/auth/staff-capabilities";

type MektekSessionUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  logisticsStaffArea?: LogisticsStaffArea | null;
  staffCapabilities?: readonly StaffCapability[] | null;
  userStatus?: string | null;
};

// A suspended (non-ACTIVE) user must not pass any Mektek capability check, even if
// their still-valid JWT carries a role. `lib/auth.ts` builds a full session for
// PENDING/INACTIVE users, and the Mektek server actions + API gates authorize via
// these predicates — so this is the single, shared enforcement point for userStatus
// across actions, API routes, and UI gating. The no-auth guest session is hard-coded
// to userStatus "ACTIVE" (lib/session.ts), so local no-auth dev is unaffected.
function isActive(user?: MektekSessionUser | null) {
  return user?.userStatus === "ACTIVE";
}

// The central enforcement seam (per docs/staff-authorization.md step 3). Every
// capability check funnels through this single predicate: the owner is an
// unconditional allow, an active sub-admin must hold the named capability, and the
// legacy mektekRole values (CS/TECHNICIAN) keep their original access for backward
// compatibility. Hiding a sidebar link alone is never authorization; every page,
// server action, route handler, export, and document gate calls a `canX` below which
// in turn calls `hasCapability`.
function hasCapability(
  user: MektekSessionUser | null | undefined,
  capability: StaffCapability,
): boolean {
  if (!isActive(user)) return false;
  if (user?.isAdmin) return true;
  const capabilities = user?.staffCapabilities ?? [];
  if (capabilities.includes(capability)) return true;
  // Legacy operational roles retain access so unrelated work does not silently drop
  // permissions. Both CS and TECHNICIAN map to the MEKTEK_CUSTOMER_SERVICE bundle
  // because the nine granular customer-service capabilities were collapsed into it.
  // Do not merge mektekRole into staffCapabilities.
  if (user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN") {
    return capability === "MEKTEK_CUSTOMER_SERVICE";
  }
  return false;
}

export function hasMektekCapability(
  user: MektekSessionUser | null | undefined,
  capability: StaffCapability,
): boolean {
  return hasCapability(user, capability);
}

// A sub-admin is any active account with at least one assigned capability or a
// legacy division/role. The owner is a separate (unconditional) case handled by
// the `canX` predicates via hasCapability.
function isDivisionStaff(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.staffDivision ||
      (user?.staffCapabilities && user.staffCapabilities.length > 0) ||
      !!user?.mektekRole)
  );
}

export function canCreateMektekOrders(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  // Any active sub-admin (capability, legacy division, or mektekRole) plus the
  // owner may reach the staff portal shell. Specific pages enforce their own
  // capability via the `canX` predicates.
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canViewMektekOrders(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canManageMektekCatalog(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CATALOG");
}

export function canManageMektekLogistics(
  user?: MektekSessionUser | null,
  area?: LogisticsStaffArea,
) {
  if (!isActive(user)) return false;
  if (user?.isAdmin) return true;
  return hasCapability(
    user,
    area === "RECEIVING" ? "MEKTEK_RECEIVING" : "MEKTEK_MONITORING_PO",
  );
}

// Finance (Pembayaran Pemasok + Laporan Hutang Pemasok) is a confidential ledger
// workspace. Only the owner or an active account with the MEKTEK_FINANCE capability
// may view, manage, or approve it.
export function canManageMektekFinance(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_FINANCE");
}

// Accounting (Ringkasan, Rekap Invoice/SJ, Pendapatan, Kontrak, Audit, Payment
// Faktur) is a separate confidential workspace gated by MEKTEK_ACCOUNTING.
export function canManageMektekAccounting(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_ACCOUNTING");
}

// The finance layout shell (/mektek/finance/**) is shared by both Finance and
// Accounting staff; individual pages enforce the specific capability. This helper
// grants entry if the user holds either capability.
export function canViewMektekFinance(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.isAdmin ||
      hasCapability(user, "MEKTEK_FINANCE") ||
      hasCapability(user, "MEKTEK_ACCOUNTING"))
  );
}

export const canApproveMektekFinance = canManageMektekFinance;
export const canApproveMektekAccounting = canManageMektekAccounting;
export const canViewMektekAccounting = canManageMektekAccounting;

export function canManageMektekSchedule(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}

export function canManageMektekVouchers(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_SERVICE");
}
