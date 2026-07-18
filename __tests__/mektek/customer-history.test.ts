import { summarizeCustomerServiceHistory } from "@/lib/mektek/customer-history";

describe("summarizeCustomerServiceHistory", () => {
  it("separates completed and open service orders", () => {
    expect(
      summarizeCustomerServiceHistory(["COMPLETE", "ACTIVE", "PENDING", null]),
    ).toEqual({ total: 4, completed: 1, open: 3 });
  });

  it("returns zeroes for a new customer", () => {
    expect(summarizeCustomerServiceHistory([])).toEqual({
      total: 0,
      completed: 0,
      open: 0,
    });
  });
});
