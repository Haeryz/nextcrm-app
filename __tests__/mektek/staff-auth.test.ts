import { canAuthenticateOnStaffPortal } from "@/lib/mektek/staff-auth";

describe("canAuthenticateOnStaffPortal", () => {
  it("allows active admin, legacy operations roles, and division staff", () => {
    expect(
      canAuthenticateOnStaffPortal({ is_admin: true, userStatus: "ACTIVE" }),
    ).toBe(true);
    expect(
      canAuthenticateOnStaffPortal({
        mektekRole: "CS",
        userStatus: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      canAuthenticateOnStaffPortal({
        mektekRole: "TECHNICIAN",
        userStatus: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      canAuthenticateOnStaffPortal({
        staffDivision: "FINANCE",
        userStatus: "ACTIVE",
      }),
    ).toBe(true);
  });

  it("rejects customers and suspended staff", () => {
    expect(
      canAuthenticateOnStaffPortal({ is_admin: false, userStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      canAuthenticateOnStaffPortal({
        staffDivision: "HUMAN_RESOURCES",
        userStatus: "INACTIVE",
      }),
    ).toBe(false);
  });
});
