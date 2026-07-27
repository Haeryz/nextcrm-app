import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekAccounting,
  canManageMektekCatalog,
  canManageMektekFinance,
  canManageMektekLogistics,
  canManageMektekPayments,
  canManageMektekSchedule,
  canManageMektekVouchers,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
  canViewMektekOrders,
} from "@/lib/mektek/permissions";
import { BROAD_LEGACY_CAPABILITIES } from "@/lib/auth/staff-capabilities";

describe("MekTek permissions", () => {
  it("keeps admin access broad", () => {
    const admin = { isAdmin: true, mektekRole: null, userStatus: "ACTIVE" };
    expect(canAccessMektekStaffArea(admin)).toBe(true);
    expect(canCreateMektekOrders(admin)).toBe(true);
    expect(canUseMektekCustomerTools(admin)).toBe(true);
    expect(canUpdateMektekProgress(admin)).toBe(true);
    expect(canManageMektekPayments(admin)).toBe(true);
    expect(canManageMektekLogistics(admin)).toBe(true);
    expect(canManageMektekCatalog(admin)).toBe(true);
    expect(canViewMektekOrders(admin)).toBe(true);
    expect(canManageMektekVouchers(admin)).toBe(true);
    expect(canManageMektekSchedule(admin)).toBe(true);
    expect(canViewMektekDashboard(admin)).toBe(true);
    expect(canManageMektekFinance(admin)).toBe(true);
    expect(canManageMektekAccounting(admin)).toBe(true);
  });

  it("grants a Finance sub-admin exactly the FINANCE capability (capability-based)", () => {
    const finance = {
      isAdmin: false,
      mektekRole: null,
      staffDivision: "FINANCE" as const,
      staffCapabilities: ["MEKTEK_FINANCE"] as const,
      userStatus: "ACTIVE",
    };

    expect(canAccessMektekStaffArea(finance)).toBe(true);
    expect(canManageMektekFinance(finance)).toBe(true);
    expect(canManageMektekAccounting(finance)).toBe(false);
    // A capability-scoped sub-admin does not get broad access to other areas.
    expect(canCreateMektekOrders(finance)).toBe(false);
    expect(canUseMektekCustomerTools(finance)).toBe(false);
    expect(canUpdateMektekProgress(finance)).toBe(false);
    expect(canManageMektekPayments(finance)).toBe(false);
    expect(canManageMektekLogistics(finance)).toBe(false);
    expect(canManageMektekVouchers(finance)).toBe(false);
    expect(canManageMektekSchedule(finance)).toBe(false);
    expect(canViewMektekDashboard(finance)).toBe(false);
    expect(canManageMektekCatalog(finance)).toBe(false);

    // Admin reassigning a Finance division user to Logistics capabilities removes finance access.
    expect(
      canManageMektekFinance({
        ...finance,
        staffCapabilities: ["MEKTEK_RECEIVING"] as const,
      }),
    ).toBe(false);
  });

  it("grants an Accounting sub-admin exactly the ACCOUNTING capability", () => {
    const accounting = {
      isAdmin: false,
      mektekRole: null,
      staffCapabilities: ["MEKTEK_ACCOUNTING"] as const,
      userStatus: "ACTIVE",
    };

    expect(canManageMektekAccounting(accounting)).toBe(true);
    expect(canManageMektekFinance(accounting)).toBe(false);
    expect(canCreateMektekOrders(accounting)).toBe(false);
    expect(canManageMektekCatalog(accounting)).toBe(false);
    expect(canViewMektekDashboard(accounting)).toBe(false);
  });

  it("limits Logistics staff to Catalog and their assigned Logistics area", () => {
    const monitoring = {
      isAdmin: false,
      staffDivision: "LOGISTICS" as const,
      logisticsStaffArea: "MONITORING_PO" as const,
      staffCapabilities: ["MEKTEK_CATALOG", "MEKTEK_MONITORING_PO"] as const,
      userStatus: "ACTIVE",
    };
    const receiving = {
      ...monitoring,
      logisticsStaffArea: "RECEIVING" as const,
      staffCapabilities: ["MEKTEK_CATALOG", "MEKTEK_RECEIVING"] as const,
    };
    const unassigned = {
      ...monitoring,
      logisticsStaffArea: null,
      staffCapabilities: ["MEKTEK_CATALOG"] as const,
    };

    for (const user of [monitoring, receiving, unassigned]) {
      expect(canAccessMektekStaffArea(user)).toBe(true);
      expect(canManageMektekCatalog(user)).toBe(true);
      expect(canViewMektekOrders(user)).toBe(false);
      expect(canViewMektekDashboard(user)).toBe(false);
      expect(canUseMektekCustomerTools(user)).toBe(false);
      expect(canManageMektekPayments(user)).toBe(false);
    }
    expect(canManageMektekLogistics(monitoring, "MONITORING_PO")).toBe(true);
    expect(canManageMektekLogistics(monitoring, "RECEIVING")).toBe(false);
    expect(canManageMektekLogistics(receiving, "MONITORING_PO")).toBe(false);
    expect(canManageMektekLogistics(receiving, "RECEIVING")).toBe(true);
    expect(canManageMektekLogistics(unassigned)).toBe(false);
  });

  it("maps both CS and TECHNICIAN legacy roles to the Customer Service bundle", () => {
    const cs = { isAdmin: false, mektekRole: "CS" as const, userStatus: "ACTIVE" };
    const technician = {
      isAdmin: false,
      mektekRole: "TECHNICIAN" as const,
      userStatus: "ACTIVE",
    };

    // Both legacy roles now map to the MEKTEK_CUSTOMER_SERVICE bundle, which
    // includes all nine former granular capabilities.
    for (const user of [cs, technician]) {
      expect(canCreateMektekOrders(user)).toBe(true);
      expect(canUseMektekCustomerTools(user)).toBe(true);
      expect(canUpdateMektekProgress(user)).toBe(true);
      expect(canManageMektekPayments(user)).toBe(true);
      expect(canManageMektekSchedule(user)).toBe(true);
      expect(canManageMektekVouchers(user)).toBe(true);
      expect(canViewMektekDashboard(user)).toBe(true);
      expect(canViewMektekOrders(user)).toBe(true);
      // But still denied non-customer-service capabilities.
      expect(canManageMektekLogistics(user)).toBe(false);
      expect(canManageMektekCatalog(user)).toBe(false);
      expect(canManageMektekFinance(user)).toBe(false);
      expect(canManageMektekAccounting(user)).toBe(false);
    }
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
      expect(canManageMektekFinance(customer)).toBe(false);
      expect(canManageMektekAccounting(customer)).toBe(false);
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
      expect(canManageMektekFinance(user)).toBe(false);
      expect(canManageMektekAccounting(user)).toBe(false);
    }
  });

  it("references the canonical broad legacy set used by the backfill", () => {
    expect(BROAD_LEGACY_CAPABILITIES).toContain("MEKTEK_CUSTOMER_SERVICE");
    expect(BROAD_LEGACY_CAPABILITIES).not.toContain("MEKTEK_FINANCE");
    expect(BROAD_LEGACY_CAPABILITIES).not.toContain("MEKTEK_ACCOUNTING");
  });
});
