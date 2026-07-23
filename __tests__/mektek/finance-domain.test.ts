import {
  buildFinanceBalance,
  canApproveFinanceRequest,
  getContractReminderMilestones,
  getFinanceDocumentState,
  hasSupplyWindowConflict,
  validateBillingSourceGrouping,
} from "@/lib/mektek/finance";

describe("finance domain controls", () => {
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
});
