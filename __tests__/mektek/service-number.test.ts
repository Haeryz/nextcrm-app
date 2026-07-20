import {
  formatMektekServiceNumber,
  getMektekServiceMonthKey,
  reserveMektekServiceNumber,
} from "@/lib/mektek/service-number";

describe("Mektek monthly service numbers", () => {
  it("uses the Asia/Makassar month at the exact UTC month boundary", () => {
    expect(getMektekServiceMonthKey(new Date("2026-07-31T15:59:59.999Z"))).toBe(
      "202607",
    );
    expect(getMektekServiceMonthKey(new Date("2026-07-31T16:00:00.000Z"))).toBe(
      "202608",
    );
  });

  it("formats an explicit month and a zero-padded sequence", () => {
    expect(formatMektekServiceNumber("202607", 1)).toBe("SRV-202607-0001");
    expect(formatMektekServiceNumber("202607", 42)).toBe("SRV-202607-0042");
  });

  it("atomically increments a dedicated monthly counter", async () => {
    const upsert = jest.fn().mockResolvedValue({
      monthKey: "202607",
      lastValue: 7,
    });

    await expect(
      reserveMektekServiceNumber(
        { mektekServiceMonthlySequence: { upsert } },
        new Date("2026-07-20T04:00:00.000Z"),
      ),
    ).resolves.toBe("SRV-202607-0007");

    expect(upsert).toHaveBeenCalledWith({
      where: { monthKey: "202607" },
      create: { monthKey: "202607", lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { monthKey: true, lastValue: true },
    });
  });

  it("rejects invalid month keys and sequence values", () => {
    expect(() => formatMektekServiceNumber("2026-07", 1)).toThrow();
    expect(() => formatMektekServiceNumber("202607", 0)).toThrow();
  });
});
