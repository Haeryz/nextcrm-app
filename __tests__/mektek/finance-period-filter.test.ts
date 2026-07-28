import {
  formatFinancePeriodLabel,
  isFinancePeriodActive,
  parseFinancePeriodParams,
  resolveFinanceDateRange,
  serializeFinancePeriodParams,
  type FinancePeriodFilter,
} from "@/app/[locale]/(routes)/mektek/finance/_lib/period-filter";

const EMPTY: FinancePeriodFilter = {
  mode: "all",
  month: "",
  fromMonth: "",
  toMonth: "",
  year: "",
};

describe("finance period filter", () => {
  describe("parseFinancePeriodParams", () => {
    it("returns the all filter when no mode is provided", () => {
      expect(parseFinancePeriodParams(undefined)).toEqual(EMPTY);
      expect(parseFinancePeriodParams({})).toEqual(EMPTY);
    });

    it("rejects an unknown mode", () => {
      expect(parseFinancePeriodParams({ periodMode: "decade" })).toEqual(EMPTY);
    });

    it("parses the three supported modes", () => {
      expect(
        parseFinancePeriodParams({
          periodMode: "month",
          month: "2026-01",
        }),
      ).toEqual({ ...EMPTY, mode: "month", month: "2026-01" });

      expect(
        parseFinancePeriodParams({
          periodMode: "range",
          fromMonth: "2026-01",
          toMonth: "2026-03",
        }),
      ).toEqual({
        ...EMPTY,
        mode: "range",
        fromMonth: "2026-01",
        toMonth: "2026-03",
      });

      expect(
        parseFinancePeriodParams({ periodMode: "year", year: "2026" }),
      ).toEqual({ ...EMPTY, mode: "year", year: "2026" });
    });

    it("reads the first value of array params", () => {
      expect(
        parseFinancePeriodParams({
          periodMode: ["month", "year"],
          month: ["2026-01", "2026-02"],
        }),
      ).toEqual({ ...EMPTY, mode: "month", month: "2026-01" });
    });
  });

  describe("resolveFinanceDateRange", () => {
    it("returns null for the all filter", () => {
      expect(resolveFinanceDateRange(EMPTY)).toBeNull();
    });

    it("builds a half-open [from, to) range for a single month", () => {
      const range = resolveFinanceDateRange({
        ...EMPTY,
        mode: "month",
        month: "2026-01",
      });
      expect(range).not.toBeNull();
      expect(range!.from).toEqual(new Date(2026, 0, 1));
      // Exclusive upper bound = start of the next month.
      expect(range!.to).toEqual(new Date(2026, 1, 1));
      expect(range!.to > range!.from).toBe(true);
    });

    it("builds a half-open range spanning multiple months", () => {
      const range = resolveFinanceDateRange({
        ...EMPTY,
        mode: "range",
        fromMonth: "2026-01",
        toMonth: "2026-03",
      });
      expect(range).not.toBeNull();
      expect(range!.from).toEqual(new Date(2026, 0, 1));
      // Jan through March → exclusive upper bound is April 1.
      expect(range!.to).toEqual(new Date(2026, 3, 1));
    });

    it("normalizes a reversed range so `from` is the earlier month", () => {
      const range = resolveFinanceDateRange({
        ...EMPTY,
        mode: "range",
        fromMonth: "2026-03",
        toMonth: "2026-01",
      });
      expect(range).not.toBeNull();
      expect(range!.from).toEqual(new Date(2026, 0, 1));
      expect(range!.to).toEqual(new Date(2026, 3, 1));
    });

    it("builds a half-open range for a whole year", () => {
      const range = resolveFinanceDateRange({
        ...EMPTY,
        mode: "year",
        year: "2026",
      });
      expect(range).not.toBeNull();
      expect(range!.from).toEqual(new Date(2026, 0, 1));
      expect(range!.to).toEqual(new Date(2027, 0, 1));
    });

    it("returns null when the selected mode has incomplete inputs", () => {
      expect(
        resolveFinanceDateRange({ ...EMPTY, mode: "month", month: "" }),
      ).toBeNull();
      expect(
        resolveFinanceDateRange({ ...EMPTY, mode: "month", month: "2026-13" }),
      ).toBeNull();
      expect(
        resolveFinanceDateRange({
          ...EMPTY,
          mode: "range",
          fromMonth: "2026-01",
          toMonth: "",
        }),
      ).toBeNull();
      expect(
        resolveFinanceDateRange({ ...EMPTY, mode: "year", year: "" }),
      ).toBeNull();
      expect(
        resolveFinanceDateRange({ ...EMPTY, mode: "year", year: "abcd" }),
      ).toBeNull();
    });
  });

  describe("isFinancePeriodActive", () => {
    it("is true only when the filter resolves to a date range", () => {
      expect(isFinancePeriodActive(EMPTY)).toBe(false);
      expect(
        isFinancePeriodActive({ ...EMPTY, mode: "month", month: "2026-01" }),
      ).toBe(true);
      expect(
        isFinancePeriodActive({ ...EMPTY, mode: "month", month: "" }),
      ).toBe(false);
    });
  });

  describe("formatFinancePeriodLabel", () => {
    it("describes the all filter", () => {
      expect(formatFinancePeriodLabel(EMPTY)).toBe("Semua periode");
    });

    it("describes a single month in Bahasa Indonesia", () => {
      expect(
        formatFinancePeriodLabel({ ...EMPTY, mode: "month", month: "2026-01" }),
      ).toBe("Januari 2026");
      expect(
        formatFinancePeriodLabel({ ...EMPTY, mode: "month", month: "2026-12" }),
      ).toBe("Desember 2026");
    });

    it("describes a range within the same year without repeating the year", () => {
      expect(
        formatFinancePeriodLabel({
          ...EMPTY,
          mode: "range",
          fromMonth: "2026-01",
          toMonth: "2026-03",
        }),
      ).toBe("Januari–Maret 2026");
    });

    it("describes a range across two years", () => {
      expect(
        formatFinancePeriodLabel({
          ...EMPTY,
          mode: "range",
          fromMonth: "2025-11",
          toMonth: "2026-02",
        }),
      ).toBe("November 2025–Februari 2026");
    });

    it("describes a whole year", () => {
      expect(
        formatFinancePeriodLabel({ ...EMPTY, mode: "year", year: "2026" }),
      ).toBe("Tahun 2026");
    });

    it("falls back to the all label for incomplete inputs", () => {
      expect(
        formatFinancePeriodLabel({ ...EMPTY, mode: "month", month: "" }),
      ).toBe("Semua periode");
    });
  });

  describe("serializeFinancePeriodParams", () => {
    it("omits everything for the all filter", () => {
      expect(serializeFinancePeriodParams(EMPTY)).toEqual({});
    });

    it("serializes only the fields relevant to the active mode", () => {
      expect(
        serializeFinancePeriodParams({
          ...EMPTY,
          mode: "month",
          month: "2026-01",
        }),
      ).toEqual({ periodMode: "month", month: "2026-01" });

      expect(
        serializeFinancePeriodParams({
          ...EMPTY,
          mode: "range",
          fromMonth: "2026-01",
          toMonth: "2026-03",
        }),
      ).toEqual({
        periodMode: "range",
        fromMonth: "2026-01",
        toMonth: "2026-03",
      });

      expect(
        serializeFinancePeriodParams({
          ...EMPTY,
          mode: "year",
          year: "2026",
        }),
      ).toEqual({ periodMode: "year", year: "2026" });
    });
  });
});
