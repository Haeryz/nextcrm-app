import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekLogistics,
  canManageMektekVouchers,
  canManageMektekPayments,
  canManageMektekSchedule,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
} from "@/lib/mektek/permissions";

describe("MekTek permissions", () => {
  it("keeps admin access broad", () => {
    const admin = { isAdmin: true, mektekRole: null, userStatus: "ACTIVE" };
    expect(canAccessMektekStaffArea(admin)).toBe(true);
    expect(canCreateMektekOrders(admin)).toBe(true);
    expect(canUseMektekCustomerTools(admin)).toBe(true);
    expect(canUpdateMektekProgress(admin)).toBe(true);
    expect(canManageMektekPayments(admin)).toBe(true);
    expect(canManageMektekLogistics(admin)).toBe(true);
    expect(canManageMektekVouchers(admin)).toBe(true);
    expect(canManageMektekSchedule(admin)).toBe(true);
    expect(canViewMektekDashboard(admin)).toBe(true);
  });

  it("keeps division staff access broad until the authorization phase", () => {
    const finance = {
      isAdmin: false,
      mektekRole: null,
      staffDivision: "FINANCE" as const,
      userStatus: "ACTIVE",
    };

    expect(canAccessMektekStaffArea(finance)).toBe(true);
    expect(canCreateMektekOrders(finance)).toBe(true);
    expect(canUseMektekCustomerTools(finance)).toBe(true);
    expect(canUpdateMektekProgress(finance)).toBe(true);
    expect(canManageMektekPayments(finance)).toBe(true);
    expect(canManageMektekLogistics(finance)).toBe(true);
    expect(canManageMektekVouchers(finance)).toBe(true);
    expect(canManageMektekSchedule(finance)).toBe(true);
    expect(canViewMektekDashboard(finance)).toBe(true);
  });

  it("splits CS and technician capabilities", () => {
    const cs = { isAdmin: false, mektekRole: "CS" as const, userStatus: "ACTIVE" };
    const technician = {
      isAdmin: false,
      mektekRole: "TECHNICIAN" as const,
      userStatus: "ACTIVE",
    };

    expect(canCreateMektekOrders(cs)).toBe(true);
    expect(canUseMektekCustomerTools(cs)).toBe(true);
    expect(canUpdateMektekProgress(cs)).toBe(false);
    expect(canManageMektekPayments(cs)).toBe(false);
    expect(canManageMektekLogistics(cs)).toBe(false);
    expect(canManageMektekVouchers(cs)).toBe(false);
    expect(canManageMektekSchedule(cs)).toBe(false);
    expect(canViewMektekDashboard(cs)).toBe(false);

    expect(canCreateMektekOrders(technician)).toBe(false);
    expect(canUseMektekCustomerTools(technician)).toBe(false);
    expect(canUpdateMektekProgress(technician)).toBe(true);
    expect(canManageMektekPayments(technician)).toBe(false);
    expect(canManageMektekLogistics(technician)).toBe(false);
    expect(canManageMektekVouchers(technician)).toBe(false);
    expect(canManageMektekSchedule(technician)).toBe(false);
    expect(canViewMektekDashboard(technician)).toBe(false);
  });

  it("keeps standard and B2B customer accounts out of staff/admin areas", () => {
    const standardCustomer = { isAdmin: false, mektekRole: null, userStatus: "ACTIVE" };
    const b2bCustomer = { isAdmin: false, mektekRole: null, userStatus: "ACTIVE" };

    for (const customer of [standardCustomer, b2bCustomer]) {
      expect(canAccessMektekStaffArea(customer)).toBe(false);
      expect(canCreateMektekOrders(customer)).toBe(false);
      expect(canUseMektekCustomerTools(customer)).toBe(false);
      expect(canUpdateMektekProgress(customer)).toBe(false);
      expect(canManageMektekPayments(customer)).toBe(false);
      expect(canManageMektekLogistics(customer)).toBe(false);
      expect(canManageMektekVouchers(customer)).toBe(false);
      expect(canManageMektekSchedule(customer)).toBe(false);
      expect(canViewMektekDashboard(customer)).toBe(false);
    }
  });

  it("denies suspended (non-ACTIVE) staff even with a role", () => {
    // A PENDING/INACTIVE user keeps a valid JWT with their role; userStatus must
    // still shut every capability off. Missing userStatus is treated as inactive.
    const suspendedAdmin = { isAdmin: true, mektekRole: null, userStatus: "INACTIVE" };
    const pendingCs = { isAdmin: false, mektekRole: "CS" as const, userStatus: "PENDING" };
    const noStatusAdmin = { isAdmin: true, mektekRole: null };

    for (const user of [suspendedAdmin, pendingCs, noStatusAdmin]) {
      expect(canAccessMektekStaffArea(user)).toBe(false);
      expect(canCreateMektekOrders(user)).toBe(false);
      expect(canUseMektekCustomerTools(user)).toBe(false);
      expect(canUpdateMektekProgress(user)).toBe(false);
      expect(canManageMektekPayments(user)).toBe(false);
      expect(canManageMektekLogistics(user)).toBe(false);
      expect(canManageMektekVouchers(user)).toBe(false);
      expect(canManageMektekSchedule(user)).toBe(false);
      expect(canViewMektekDashboard(user)).toBe(false);
    }
  });
});
