type MektekSessionUser = {
  isAdmin?: boolean | null;
  mektekRole?: "CS" | "TECHNICIAN" | null;
};

export function canCreateMektekOrders(user?: MektekSessionUser | null) {
  return !!user?.isAdmin || user?.mektekRole === "CS";
}

export function canAccessMektekStaffArea(user?: MektekSessionUser | null) {
  return !!user?.isAdmin || user?.mektekRole === "CS" || user?.mektekRole === "TECHNICIAN";
}

export function canViewMektekDashboard(user?: MektekSessionUser | null) {
  return !!user?.isAdmin;
}

export function canUseMektekCustomerTools(user?: MektekSessionUser | null) {
  return !!user?.isAdmin || user?.mektekRole === "CS";
}

export function canUpdateMektekProgress(user?: MektekSessionUser | null) {
  return !!user?.isAdmin || user?.mektekRole === "TECHNICIAN";
}

export function canManageMektekPayments(user?: MektekSessionUser | null) {
  return !!user?.isAdmin;
}

export function canManageMektekCustomers(user?: MektekSessionUser | null) {
  return !!user?.isAdmin;
}
