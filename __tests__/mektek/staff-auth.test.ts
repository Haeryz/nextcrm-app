import { canAuthenticateOnStaffPortal } from "@/lib/mektek/staff-auth";

describe("canAuthenticateOnStaffPortal", () => {
  it("allows only active admin, CS, and technician accounts", () => {
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
  });

  it("rejects customers and suspended staff", () => {
    expect(
      canAuthenticateOnStaffPortal({ is_admin: false, userStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      canAuthenticateOnStaffPortal({
        is_admin: true,
        userStatus: "INACTIVE",
      }),
    ).toBe(false);
  });
});
