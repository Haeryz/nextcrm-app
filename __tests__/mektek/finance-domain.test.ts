import {
  buildFinanceBalance,
  buildFinanceRevenueSplit,
  canApproveFinanceRequest,
  classifyFinanceRevenueLine,
  getContractDaysRemaining,
  getContractReminderMilestones,
  getFinanceDocumentState,
  hasSupplyWindowConflict,
  parseFinanceContractPeriodEnd,
  validateBillingSourceGrouping,
} from "@/lib/mektek/finance";

describe("finance domain controls", () => {
  it("classifies invoice lines as jasa or spare part from kind and description", () => {
    expect(
      classifyFinanceRevenueLine({
        kind: "SPARE_PART",
        description: "Filter hydraulic",
      }),
    ).toBe("sparepart");
    expect(
      classifyFinanceRevenueLine({
        kind: "MANUAL",
        description: "Jasa servis dan perbaikan unit",
      }),
    ).toBe("service");
    expect(
      classifyFinanceRevenueLine({
        kind: "MANUAL",
        description: "Spare part hose assembly",
      }),
    ).toBe("sparepart");
  });

  it("splits mixed invoices into automatic jasa and spare-part revenue", () => {
    expect(
      buildFinanceRevenueSplit({
        taxAmount: 100_000,
        lines: [
          {
            kind: "service",
            description: "Jasa overhaul",
            lineTotal: 600_000,
          },
          {
            kind: "sparepart",
            description: "Spare part seal kit",
            lineTotal: 400_000,
          },
        ],
      }),
    ).toEqual({
      service: {
        subtotal: 600_000,
        taxAmount: 60_000,
        total: 660_000,
        descriptions: ["Jasa overhaul"],
      },
      sparepart: {
        subtotal: 400_000,
        taxAmount: 40_000,
        total: 440_000,
        descriptions: ["Spare part seal kit"],
      },
      unclassified: {
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        descriptions: [],
      },
    });
  });

  it("does not silently count mixed or unclear descriptions as jasa", () => {
    expect(
      classifyFinanceRevenueLine({
        kind: "MANUAL",
        description: "Jasa pemasangan dan spare part",
      }),
    ).toBe("unclassified");
    expect(
      classifyFinanceRevenueLine({
        kind: "MANUAL",
        description: "Pekerjaan proyek",
      }),
    ).toBe("unclassified");
  });

  it("derives paid, partial, and overdue states from active allocations", () => {
    expect(buildFinanceBalance(1_000_000, [250_000, 125_000])).toEqual({
      allocated: 375_000,
      balance: 625_000,
    });
    expect(
      getFinanceDocumentState({
        total: 1_000_000,
        allocations: [375_000],
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
        now: new Date("2026-07-22T00:00:00.000Z"),
      }),
    ).toBe("OVERDUE");
    expect(
      getFinanceDocumentState({
        total: 1_000_000,
        allocations: [1_000_000],
        dueDate: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).toBe("PAID");
  });

  it("does not let a requester approve their own finance action", () => {
    expect(canApproveFinanceRequest("user-a", "user-a")).toBe(false);
    expect(canApproveFinanceRequest("user-a", "user-b")).toBe(true);
  });

  it("only groups compatible billing sources", () => {
    expect(
      validateBillingSourceGrouping([
        {
          counterpartyId: "customer-1",
          currency: "IDR",
          taxProfile: "PPN11_PPH2",
          paymentTermsDays: 30,
          contractId: "contract-1",
        },
        {
          counterpartyId: "customer-1",
          currency: "IDR",
          taxProfile: "PPN11_PPH2",
          paymentTermsDays: 30,
          contractId: "contract-1",
        },
      ]),
    ).toEqual({ ok: true });

    expect(
      validateBillingSourceGrouping([
        {
          counterpartyId: "customer-1",
          currency: "IDR",
          taxProfile: "PPN11_PPH2",
          paymentTermsDays: 30,
          contractId: "contract-1",
        },
        {
          counterpartyId: "customer-2",
          currency: "IDR",
          taxProfile: "PPN11_PPH2",
          paymentTermsDays: 30,
          contractId: "contract-1",
        },
      ]),
    ).toEqual({ ok: false, reason: "COUNTERPARTY_MISMATCH" });
  });

  it("detects intersecting supply windows only across PO modes", () => {
    const existing = {
      counterpartyId: "customer-1",
      projectKey: "site-a",
      itemKey: "part-100",
      mode: "CONSIGNMENT" as const,
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-31T00:00:00.000Z"),
    };

    expect(
      hasSupplyWindowConflict(existing, {
        ...existing,
        mode: "MANUAL",
        startDate: new Date("2026-07-31T00:00:00.000Z"),
        endDate: new Date("2026-08-02T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      hasSupplyWindowConflict(existing, {
        ...existing,
        mode: "CONSIGNMENT",
      }),
    ).toBe(false);
  });

  it("returns unsent 30, 14, and 7 day contract reminders", () => {
    expect(
      getContractReminderMilestones({
        endDate: new Date("2026-08-21T00:00:00.000Z"),
        now: new Date("2026-07-22T00:00:00.000Z"),
        sentMilestones: [],
      }),
    ).toEqual([30]);
    expect(
      getContractReminderMilestones({
        endDate: new Date("2026-08-05T00:00:00.000Z"),
        now: new Date("2026-07-22T00:00:00.000Z"),
        sentMilestones: [14],
      }),
    ).toEqual([]);
  });

  it("marks active contracts as near expiry throughout their final week", () => {
    const now = new Date("2026-07-23T10:00:00.000Z");
    expect(
      getContractDaysRemaining(new Date("2026-07-30T00:00:00.000Z"), now),
    ).toBe(7);
    expect(
      getContractDaysRemaining(new Date("2026-07-31T00:00:00.000Z"), now),
    ).toBe(8);
    expect(
      getContractDaysRemaining(new Date("2026-07-23T00:00:00.000Z"), now),
    ).toBe(0);
  });

  it("reads the contract end date from Indonesian or English period text", () => {
    expect(
      parseFinanceContractPeriodEnd("01 FEBRUARY 2026 - 31 January 2027"),
    ).toEqual(new Date("2027-01-31T00:00:00.000Z"));
    expect(
      parseFinanceContractPeriodEnd("02 February 2026 - 31 Desember 2026"),
    ).toEqual(new Date("2026-12-31T00:00:00.000Z"));
    expect(
      parseFinanceContractPeriodEnd("01 January s/d 31 Desember 2025"),
    ).toEqual(new Date("2025-12-31T00:00:00.000Z"));
  });
});
