import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

import {
  BROAD_LEGACY_CAPABILITIES,
  capabilitiesForLegacyDivision,
  isStaffCapability,
  normalizeStaffCapabilities,
  STAFF_CAPABILITIES,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekCatalog,
  canManageMektekCustomers,
  canManageMektekFinance,
  canManageMektekLogistics,
  canManageMektekVouchers,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
  canViewMektekDashboard,
  canViewMektekOrders,
  hasMektekCapability,
} from "@/lib/mektek/permissions";

const ACTIVE = "ACTIVE";
const INACTIVE = "INACTIVE";

type TestUser = Parameters<typeof hasMektekCapability>[0];

function subAdmin(capabilities: StaffCapability[]): TestUser {
  return {
    isAdmin: false,
    staffDivision: null,
    logisticsStaffArea: null,
    staffCapabilities: capabilities,
    userStatus: ACTIVE,
  };
}

describe("Staff capability infrastructure", () => {
  it("defines the canonical capability set in the Prisma schema", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("enum StaffCapability");
    for (const capability of STAFF_CAPABILITIES) {
      expect(schema).toContain(capability);
    }
    expect(schema).toMatch(/staffCapabilities\s+StaffCapability\[\]/);
  });

  it("validates capability values and normalizes duplicates", () => {
    expect(isStaffCapability("MEKTEK_FINANCE")).toBe(true);
    expect(isStaffCapability("NOPE")).toBe(false);
    expect(isStaffCapability(null)).toBe(false);
    expect(
      normalizeStaffCapabilities([
        "MEKTEK_FINANCE",
        "MEKTEK_FINANCE",
        "bogus",
        "MEKTEK_CATALOG",
      ]),
    ).toEqual(["MEKTEK_FINANCE", "MEKTEK_CATALOG"]);
  });

  it("backfills legacy divisions without losing existing access", () => {
    expect(
      capabilitiesForLegacyDivision("LOGISTICS", "MONITORING_PO"),
    ).toEqual(["MEKTEK_CATALOG", "MEKTEK_MONITORING_PO"]);
    expect(
      capabilitiesForLegacyDivision("LOGISTICS", "RECEIVING"),
    ).toEqual(["MEKTEK_CATALOG", "MEKTEK_RECEIVING"]);
    expect(capabilitiesForLegacyDivision("LOGISTICS", null)).toEqual([
      "MEKTEK_CATALOG",
    ]);
    expect(capabilitiesForLegacyDivision("FINANCE", null)).toContain(
      "MEKTEK_FINANCE",
    );
    expect(capabilitiesForLegacyDivision("OPERATIONS", null)).toEqual(
      BROAD_LEGACY_CAPABILITIES,
    );
    expect(capabilitiesForLegacyDivision("HUMAN_RESOURCES", null)).toEqual(
      BROAD_LEGACY_CAPABILITIES,
    );
    expect(capabilitiesForLegacyDivision(null, null)).toEqual([]);
  });
});

describe("Sub-admin capability enforcement (lib/mektek/permissions)", () => {
  it("grants the owner every capability unconditionally", () => {
    const owner: TestUser = {
      isAdmin: true,
      staffCapabilities: [],
      userStatus: ACTIVE,
    };
    for (const capability of STAFF_CAPABILITIES) {
      expect(hasMektekCapability(owner, capability)).toBe(true);
    }
  });

  it("denies a sub-admin capabilities they were not assigned", () => {
    const user = subAdmin(["MEKTEK_RECEIVING"]);
    expect(canManageMektekLogistics(user, "RECEIVING")).toBe(true);
    expect(canManageMektekLogistics(user, "MONITORING_PO")).toBe(false);
    expect(canManageMektekFinance(user)).toBe(false);
    expect(canManageMektekCatalog(user)).toBe(false);
    expect(canViewMektekDashboard(user)).toBe(false);
    expect(canManageMektekVouchers(user)).toBe(false);
  });

  it("denies every capability when the sub-admin is suspended", () => {
    const suspended: TestUser = {
      isAdmin: false,
      staffCapabilities: STAFF_CAPABILITIES,
      userStatus: INACTIVE,
    };
    expect(canManageMektekFinance(suspended)).toBe(false);
    expect(canManageMektekCatalog(suspended)).toBe(false);
    expect(canAccessMektekStaffArea(suspended)).toBe(false);
  });

  it("denies staff portal access to a customer account", () => {
    const customer: TestUser = {
      isAdmin: false,
      staffDivision: null,
      staffCapabilities: [],
      userStatus: ACTIVE,
    };
    expect(canAccessMektekStaffArea(customer)).toBe(false);
  });

  it("allows multiple capabilities on one sub-admin", () => {
    const user = subAdmin([
      "MEKTEK_CATALOG",
      "MEKTEK_MONITORING_PO",
      "MEKTEK_RECEIVING",
      "MEKTEK_FINANCE",
    ]);
    expect(canManageMektekCatalog(user)).toBe(true);
    expect(canManageMektekLogistics(user, "MONITORING_PO")).toBe(true);
    expect(canManageMektekLogistics(user, "RECEIVING")).toBe(true);
    expect(canManageMektekFinance(user)).toBe(true);
    // But still denied unrelated capabilities.
    expect(canManageMektekVouchers(user)).toBe(false);
    expect(canManageMektekCustomers(user)).toBe(false);
    expect(canViewMektekOrders(user)).toBe(false);
  });

  it("keeps the legacy mektekRole values compatible", () => {
    const cs: TestUser = {
      isAdmin: false,
      mektekRole: "CS",
      staffCapabilities: [],
      userStatus: ACTIVE,
    };
    expect(canCreateMektekOrders(cs)).toBe(true);
    expect(canUseMektekCustomerTools(cs)).toBe(true);
    expect(canManageMektekCatalog(cs)).toBe(false);
    expect(canManageMektekFinance(cs)).toBe(false);

    const technician: TestUser = {
      isAdmin: false,
      mektekRole: "TECHNICIAN",
      staffCapabilities: [],
      userStatus: ACTIVE,
    };
    expect(canUpdateMektekProgress(technician)).toBe(true);
    expect(canViewMektekOrders(technician)).toBe(true);
    expect(canCreateMektekOrders(technician)).toBe(false);
    expect(canManageMektekFinance(technician)).toBe(false);
  });

  it("removes the transitional broad-access branch for non-Logistics staff", () => {
    const source = read("lib/mektek/permissions.ts");
    expect(source).not.toContain("isBroadDivisionStaff");
    expect(source).toContain("hasCapability");
    expect(source).toContain("staffCapabilities");
  });
});

describe("Sub-admin CRUD accepts capabilities", () => {
  const actionSource = read("actions/auth/sub-admins.ts");
  const pageSource = read(
    "app/[locale]/(routes)/mektek/staff/page.tsx",
  );
  const fieldSource = read(
    "app/[locale]/(routes)/mektek/staff/_components/StaffCapabilityFields.tsx",
  );

  it("parses and persists staffCapabilities in create/update", () => {
    expect(actionSource).toContain("staffCapabilities");
    expect(actionSource).toContain("normalizeStaffCapabilities");
    expect(actionSource).toContain("formData.getAll");
    expect(actionSource).toContain(
      "Pilih minimal satu kapabilitas akses sub-admin.",
    );
  });

  it("loads and renders staffCapabilities on the staff page", () => {
    expect(pageSource).toContain("staffCapabilities: true");
    expect(pageSource).toContain("StaffCapabilityFields");
    expect(pageSource).not.toContain(
      "matriks pembatasan divisi lain masih dalam tahap penyusunan",
    );
  });

  it("renders every capability as a checkbox", () => {
    expect(fieldSource).toContain("STAFF_CAPABILITIES");
    expect(fieldSource).toContain('name="staffCapabilities"');
    expect(fieldSource).toContain('type="checkbox"');
    expect(fieldSource).toContain("STAFF_CAPABILITY_LABELS");
    expect(fieldSource).toContain("STAFF_CAPABILITY_DESCRIPTIONS");
  });

  it("protects the owner account from forged updates and deletes", () => {
    expect(actionSource).toContain("is_admin: false");
    expect(actionSource).toContain("requireAdmin()");
  });
});

describe("Session, proxy, and post-login wiring", () => {
  it("propagates staffCapabilities through JWT and session", () => {
    const types = read("types/next-auth.d.ts");
    const auth = read("lib/auth.ts");
    const session = read("lib/session.ts");
    const requestSession = read("lib/request-session.ts");

    expect(types).toContain("staffCapabilities?: StaffCapability[]");
    expect(auth).toContain("token.staffCapabilities");
    expect(auth).toContain("session.user.staffCapabilities");
    expect(session).toContain("staffCapabilities: StaffCapability[]");
    expect(requestSession).toContain("staffCapabilities: user.staffCapabilities");
  });

  it("delegates Mektek API authentication to route handlers in the proxy", () => {
    const proxy = read("proxy.ts");
    expect(proxy).not.toContain("MEKTEK_CAPABILITY_PATHS");
    expect(proxy).not.toContain("tokenHasCapability");
    expect(proxy).toContain("route handler");
  });

  it("redirects post-login based on capability", () => {
    const destination = read("lib/mektek/post-login-destination.ts");
    expect(destination).toContain("CAPABILITY_DESTINATIONS");
    expect(destination).toContain("MEKTEK_RECEIVING");
    expect(destination).toContain("staffCapabilities");
  });
});
