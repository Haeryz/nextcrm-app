import { getSafeCustomerReturnPath } from "@/lib/customer-return-path";

describe("getSafeCustomerReturnPath", () => {
  it("keeps customers on a safe storefront path after login", () => {
    expect(
      getSafeCustomerReturnPath(
        "/en/customer?view=sparepart&page=2",
        "en",
      ),
    ).toBe("/en/customer?view=sparepart&page=2");
  });

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/en/mektek/dashboard",
    "/de/customer/profile",
    "/en/customer/access",
  ])("rejects unsafe or unrelated redirects: %s", (candidate) => {
    expect(getSafeCustomerReturnPath(candidate, "en")).toBe(
      "/en/customer/profile",
    );
  });
});
