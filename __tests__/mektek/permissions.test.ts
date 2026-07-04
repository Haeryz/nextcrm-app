import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekPayments,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
} from "@/lib/mektek/permissions";

describe("MekTek permissions", () => {
  it("keeps admin access broad", () => {
    const admin = { isAdmin: true, mektekRole: null };
    expect(canAccessMektekStaffArea(admin)).toBe(true);
    expect(canCreateMektekOrders(admin)).toBe(true);
    expect(canUseMektekCustomerTools(admin)).toBe(true);
    expect(canUpdateMektekProgress(admin)).toBe(true);
    expect(canManageMektekPayments(admin)).toBe(true);
    expect(canViewMektekDashboard(admin)).toBe(true);
  });

  it("splits CS and technician capabilities", () => {
    const cs = { isAdmin: false, mektekRole: "CS" as const };
    const technician = { isAdmin: false, mektekRole: "TECHNICIAN" as const };

    expect(canCreateMektekOrders(cs)).toBe(true);
    expect(canUseMektekCustomerTools(cs)).toBe(true);
    expect(canUpdateMektekProgress(cs)).toBe(false);
    expect(canManageMektekPayments(cs)).toBe(false);
    expect(canViewMektekDashboard(cs)).toBe(false);

    expect(canCreateMektekOrders(technician)).toBe(false);
    expect(canUseMektekCustomerTools(technician)).toBe(false);
    expect(canUpdateMektekProgress(technician)).toBe(true);
    expect(canManageMektekPayments(technician)).toBe(false);
    expect(canViewMektekDashboard(technician)).toBe(false);
  });

  it("keeps standard and B2B customer accounts out of staff/admin areas", () => {
    const standardCustomer = { isAdmin: false, mektekRole: null };
    const b2bCustomer = { isAdmin: false, mektekRole: null };

    for (const customer of [standardCustomer, b2bCustomer]) {
      expect(canAccessMektekStaffArea(customer)).toBe(false);
      expect(canCreateMektekOrders(customer)).toBe(false);
      expect(canUseMektekCustomerTools(customer)).toBe(false);
      expect(canUpdateMektekProgress(customer)).toBe(false);
      expect(canManageMektekPayments(customer)).toBe(false);
      expect(canViewMektekDashboard(customer)).toBe(false);
    }
  });
});
