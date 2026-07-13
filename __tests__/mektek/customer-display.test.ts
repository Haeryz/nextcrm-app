import {
  formatCustomerDate,
  formatCustomerDateTime,
  MEKTEK_TIME_ZONE,
} from "@/lib/mektek/customer-display";

describe("customer display formatting", () => {
  it("uses the workshop time zone for deterministic server/client output", () => {
    expect(MEKTEK_TIME_ZONE).toBe("Asia/Makassar");
    expect(formatCustomerDate("2026-07-12T22:39:00.000Z")).toBe("13/7/2026");
    expect(formatCustomerDateTime("2026-07-12T22:39:00.000Z")).toBe(
      "13/7/2026 - 06.39",
    );
  });

  it("renders placeholders for missing dates", () => {
    expect(formatCustomerDate(null)).toBe("Belum ditentukan");
    expect(formatCustomerDateTime(null)).toBe("-");
  });
});
