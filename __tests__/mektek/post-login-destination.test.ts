import {
  getPostLoginDestination,
  shouldRedirectFromStaffLogin,
} from "@/lib/mektek/post-login-destination";

describe("getPostLoginDestination", () => {
  it("sends admins directly to the admin dashboard", () => {
    expect(
      getPostLoginDestination("en", {
        isAdmin: true,
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/dashboard");
  });

  it.each(["CS", "TECHNICIAN"] as const)(
    "sends %s staff directly to the operations workspace",
    (mektekRole) => {
      expect(
        getPostLoginDestination("id", {
          mektekRole,
          userStatus: "ACTIVE",
        }),
      ).toBe("/id/mektek");
    },
  );

  it("sends Logistics division staff to the general Catalog page", () => {
    expect(
      getPostLoginDestination("en", {
        staffDivision: "LOGISTICS",
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/items");
    expect(
      shouldRedirectFromStaffLogin({
        staffDivision: "LOGISTICS",
        userStatus: "ACTIVE",
      }),
    ).toBe(true);
  });

  it("routes capability-based sub-admins to their first matching workspace", () => {
    expect(
      getPostLoginDestination("en", {
        staffDivision: null,
        staffCapabilities: ["MEKTEK_FINANCE"],
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/finance/payables");
    expect(
      getPostLoginDestination("en", {
        staffDivision: null,
        staffCapabilities: ["MEKTEK_ACCOUNTING"],
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/finance");
    expect(
      getPostLoginDestination("en", {
        staffDivision: null,
        staffCapabilities: ["MEKTEK_CUSTOMER_SERVICE"],
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/dashboard");
    expect(
      getPostLoginDestination("en", {
        staffDivision: null,
        staffCapabilities: ["MEKTEK_RECEIVING"],
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/receiving");
    expect(
      getPostLoginDestination("en", {
        staffDivision: null,
        staffCapabilities: ["MEKTEK_CATALOG", "MEKTEK_MONITORING_PO"],
        userStatus: "ACTIVE",
      }),
    ).toBe("/en/mektek/logistics");
    expect(
      shouldRedirectFromStaffLogin({
        staffDivision: null,
        staffCapabilities: ["MEKTEK_FINANCE"],
        userStatus: "ACTIVE",
      }),
    ).toBe(true);
  });

  it("keeps customers on the customer profile", () => {
    expect(
      getPostLoginDestination("en", { userStatus: "ACTIVE" }),
    ).toBe("/en/customer/profile");
  });

  it("routes suspended accounts to their status page", () => {
    expect(
      getPostLoginDestination("en", { userStatus: "PENDING" }),
    ).toBe("/en/pending");
    expect(
      getPostLoginDestination("en", { userStatus: "INACTIVE" }),
    ).toBe("/en/sign-in?reason=account_inactive");
  });

  it("keeps the staff login available when a customer session already exists", () => {
    expect(
      shouldRedirectFromStaffLogin({ userStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      shouldRedirectFromStaffLogin({
        userStatus: "ACTIVE",
        mektekRole: "CS",
      }),
    ).toBe(true);
  });
});
