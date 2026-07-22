import {
  STAFF_DIVISIONS,
  isStaffDivision,
} from "@/lib/auth/staff-divisions";
import {
  LOGISTICS_STAFF_AREAS,
  isLogisticsStaffArea,
} from "@/lib/auth/logistics-staff-areas";

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

  it("defines and validates the assignable Logistics areas", () => {
    expect(LOGISTICS_STAFF_AREAS).toEqual(["MONITORING_PO", "RECEIVING"]);
    expect(isLogisticsStaffArea("MONITORING_PO")).toBe(true);
    expect(isLogisticsStaffArea("RECEIVING")).toBe(true);
    expect(isLogisticsStaffArea("CATALOG")).toBe(false);
  });
});
