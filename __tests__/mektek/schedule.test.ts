import {
  getMektekTodayDateInput,
  parseEstimatedDoneInput,
} from "@/lib/mektek/schedule";

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

describe("getMektekTodayDateInput", () => {
  it("returns the current calendar date in the MekTek timezone", () => {
    expect(getMektekTodayDateInput(new Date("2026-07-18T04:00:00.000Z"))).toBe(
      "2026-07-18",
    );
  });

  it("uses the next Makassar day when UTC is still on the previous date", () => {
    expect(getMektekTodayDateInput(new Date("2026-07-18T17:00:00.000Z"))).toBe(
      "2026-07-19",
    );
  });
});
