import type { StaffDivision } from "@/lib/auth/staff-divisions";

type MektekSessionUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
  staffDivision?: StaffDivision | null;
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

// Transitional foundation: division roles are persisted and available in the
// session, but their page/data policy is intentionally not enforced yet. Until
// that later phase, every active division staff account receives the same broad
// capability result. The owner/admin master key remains independently represented
// by isAdmin and must always bypass future division checks.
function isDivisionStaff(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.staffDivision;
}

export function canCreateMektekOrders(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isDivisionStaff(user) || user?.mektekRole === "CS");
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.isAdmin || isDivisionStaff(user) || user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN")
  );
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isDivisionStaff(user) || user?.mektekRole === "CS");
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return isActive(user) &&
    (!!user?.isAdmin || isDivisionStaff(user) || user?.mektekRole === "TECHNICIAN");
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canManageMektekLogistics(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canManageMektekSchedule(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}

export function canManageMektekVouchers(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || isDivisionStaff(user));
}
