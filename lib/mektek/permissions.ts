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
  // Legacy operational roles retain their pre-capability access so unrelated work
  // does not silently drop permissions. Do not merge mektekRole into staffCapabilities.
  if (user?.mektekRole === "CS") {
    return (
      capability === "MEKTEK_CREATE_ORDERS" ||
      capability === "MEKTEK_SERVICE_ORDERS" ||
      capability === "MEKTEK_CUSTOMER_TOOLS"
    );
  }
  if (user?.mektekRole === "TECHNICIAN") {
    return (
      capability === "MEKTEK_SERVICE_ORDERS" ||
      capability === "MEKTEK_UPDATE_PROGRESS"
    );
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
  return hasCapability(user, "MEKTEK_CREATE_ORDERS");
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  // Any active sub-admin (capability, legacy division, or mektekRole) plus the
  // owner may reach the staff portal shell. Specific pages enforce their own
  // capability via the `canX` predicates.
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_DASHBOARD");
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMER_TOOLS");
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_UPDATE_PROGRESS");
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_MANAGE_PAYMENTS");
}

export function canViewMektekOrders(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_SERVICE_ORDERS");
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

// Finance is a confidential ledger workspace. Only the owner or an active account
// with the MEKTEK_FINANCE capability may view, manage, or approve it.
export function canManageMektekFinance(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_FINANCE");
}

export const canViewMektekFinance = canManageMektekFinance;
export const canApproveMektekFinance = canManageMektekFinance;

export function canManageMektekSchedule(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_MANAGE_SCHEDULE");
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_CUSTOMERS");
}

export function canManageMektekVouchers(user?: MektekSessionUser | null) {
  return hasCapability(user, "MEKTEK_VOUCHERS");
}
