import {
  buildContractReminderDemo,
  type ContractReminderDemoCandidate,
} from "@/lib/mektek/finance-contract-reminder-demo";

describe("finance contract reminder demo", () => {
  const now = new Date("2026-07-24T00:00:00.000Z");

  it("uses the first available contract and simulates seven days remaining", () => {
    const contracts: ContractReminderDemoCandidate[] = [
      {
        contractNumber: "CTR-2026-001",
        customer: "PT Contoh Indonesia",
        endDate: new Date("2026-12-31T00:00:00.000Z"),
      },
    ];

    expect(buildContractReminderDemo(contracts, now)).toEqual({
      contractNumber: "CTR-2026-001",
      customer: "PT Contoh Indonesia",
      endDate: "2026-12-31T00:00:00.000Z",
      simulatedAt: "2026-12-24T00:00:00.000Z",
      daysRemaining: 7,
    });
  });

  it("provides a deterministic presentation fallback when no contract exists", () => {
    expect(buildContractReminderDemo([], now)).toEqual({
      contractNumber: "KONTRAK-DEMO-001",
      customer: "Pelanggan Demo",
      endDate: "2026-07-31T00:00:00.000Z",
      simulatedAt: "2026-07-24T00:00:00.000Z",
      daysRemaining: 7,
    });
  });

  it("skips candidates without a valid end date", () => {
    expect(
      buildContractReminderDemo(
        [
          {
            contractNumber: "INVALID",
            customer: "Invalid",
            endDate: null,
          },
          {
            contractNumber: "CTR-VALID",
            customer: "Valid",
            endDate: "2026-08-10T00:00:00.000Z",
          },
        ],
        now,
      ).contractNumber,
    ).toBe("CTR-VALID");
  });
});
