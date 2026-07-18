import { parseEstimatedDoneInput } from "@/lib/mektek/schedule";

describe("parseEstimatedDoneInput", () => {
  it("parses a timezone-aware estimate", () => {
    const result = parseEstimatedDoneInput("2026-07-18T09:30:00.000Z");

    expect("date" in result && result.date?.toISOString()).toBe(
      "2026-07-18T09:30:00.000Z",
    );
  });

  it("uses null to clear the estimate", () => {
    expect(parseEstimatedDoneInput(null)).toEqual({ date: null });
    expect(parseEstimatedDoneInput("  ")).toEqual({ date: null });
  });

  it("rejects invalid dates", () => {
    expect(parseEstimatedDoneInput("not-a-date")).toEqual({
      error: "Estimated done date is invalid",
    });
  });
});
