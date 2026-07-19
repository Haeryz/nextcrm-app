import {
  generatePureRandomVoucherCode,
  pickDictionaryVoucherCode,
  sanitizeVoucherDictionaryEntries,
} from "@/lib/mektek/voucher-code-generator";

describe("voucher code generator", () => {
  it("creates an uppercase pure-random code with an unambiguous alphabet", () => {
    const code = generatePureRandomVoucherCode(10, () => 0);

    expect(code).toBe("AAAAAAAAAA");
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  });

  it("normalizes, deduplicates, and bounds dictionary entries", () => {
    expect(
      sanitizeVoucherDictionaryEntries(" summer deal, SUMMER-DEAL\n vip 25 ")
    ).toEqual(["SUMMER-DEAL", "VIP-25"]);
  });

  it("picks only an unused dictionary code", () => {
    const code = pickDictionaryVoucherCode(
      ["SUMMER-DEAL", "VIP-25"],
      new Set(["SUMMERDEAL"]),
      () => 0
    );

    expect(code).toBe("VIP-25");
  });

  it("returns null when every dictionary code is already used", () => {
    expect(
      pickDictionaryVoucherCode(
        ["SUMMER-DEAL"],
        new Set(["SUMMERDEAL"]),
        () => 0
      )
    ).toBeNull();
  });
});
