import {
  formatRupiahInput,
  normalizeRupiahDigits,
} from "@/lib/rupiah";

describe("Rupiah input formatting", () => {
  it("adds Indonesian thousands separators while typing", () => {
    expect(formatRupiahInput("1000")).toBe("1.000");
    expect(formatRupiahInput("1000000")).toBe("1.000.000");
    expect(formatRupiahInput("1250000000")).toBe("1.250.000.000");
  });

  it("normalizes formatted and pasted currency text to raw digits", () => {
    expect(normalizeRupiahDigits("Rp 1.000.000")).toBe("1000000");
    expect(normalizeRupiahDigits("2,500,000")).toBe("2500000");
  });

  it("removes redundant leading zeroes without breaking zero or empty values", () => {
    expect(normalizeRupiahDigits("0001000")).toBe("1000");
    expect(formatRupiahInput("0001000")).toBe("1.000");
    expect(formatRupiahInput("0")).toBe("0");
    expect(formatRupiahInput("")).toBe("");
  });
});
