import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";

type MektekSessionUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
  logisticsStaffArea?: LogisticsStaffArea | null;
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

function isDivisionStaff(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.staffDivision;
}

function isBroadDivisionStaff(user?: MektekSessionUser | null) {
  return isDivisionStaff(user) && user?.staffDivision !== "LOGISTICS";
}

function isLogisticsStaff(user?: MektekSessionUser | null) {
  return isActive(user) && user?.staffDivision === "LOGISTICS";
}

export function canCreateMektekOrders(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isBroadDivisionStaff(user) || user?.mektekRole === "CS");
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.isAdmin || isDivisionStaff(user) || user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN")
  );
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isBroadDivisionStaff(user));
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isBroadDivisionStaff(user) || user?.mektekRole === "CS");
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isBroadDivisionStaff(user) || user?.mektekRole === "TECHNICIAN");
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isBroadDivisionStaff(user));
}

export function canViewMektekOrders(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.isAdmin ||
      isBroadDivisionStaff(user) ||
      user?.mektekRole === "CS" ||
      user?.mektekRole === "TECHNICIAN")
  );
}

export function canManageMektekCatalog(user?: MektekSessionUser | null) {
  return canCreateMektekOrders(user) || isLogisticsStaff(user);
}

export function canManageMektekLogistics(
  user?: MektekSessionUser | null,
  area?: LogisticsStaffArea,
) {
  if (!isActive(user)) return false;
  if (user?.isAdmin) return true;
  if (!isLogisticsStaff(user)) return false;
  return area
    ? user?.logisticsStaffArea === area
    : user?.logisticsStaffArea === "MONITORING_PO" ||
        user?.logisticsStaffArea === "RECEIVING";
}

export function canManageMektekSchedule(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isBroadDivisionStaff(user));
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isBroadDivisionStaff(user));
}

export function canManageMektekVouchers(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isBroadDivisionStaff(user));
}
