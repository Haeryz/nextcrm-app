type MektekSessionUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
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

export function canCreateMektekOrders(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || user?.mektekRole === "CS");
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  return (
    isActive(user) &&
    (!!user?.isAdmin || user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN")
  );
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.isAdmin;
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || user?.mektekRole === "CS");
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return isActive(user) && (!!user?.isAdmin || user?.mektekRole === "TECHNICIAN");
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.isAdmin;
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.isAdmin;
}

export function canManageMektekVouchers(user?: MektekSessionUser | null) {
  return isActive(user) && !!user?.isAdmin;
}
