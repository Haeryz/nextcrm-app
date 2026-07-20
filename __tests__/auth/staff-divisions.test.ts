import {
  STAFF_DIVISIONS,
  isStaffDivision,
} from "@/lib/auth/staff-divisions";

describe("staff divisions", () => {
  it("defines the initial business divisions centrally", () => {
    expect(STAFF_DIVISIONS).toEqual([
      "OPERATIONS",
      "CUSTOMER_SERVICE",
      "TECHNICAL",
      "LOGISTICS",
      "FINANCE",
      "HUMAN_RESOURCES",
    ]);
  });

  it("validates persisted and untrusted division values", () => {
    expect(isStaffDivision("LOGISTICS")).toBe(true);
    expect(isStaffDivision("FINANCE")).toBe(true);
    expect(isStaffDivision("OWNER")).toBe(false);
    expect(isStaffDivision(null)).toBe(false);
  });
});
