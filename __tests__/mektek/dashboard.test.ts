jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Accounts_Tasks: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prismadb } from "@/lib/prisma";
import { getMektekDashboardSummary } from "@/actions/mektek/dashboard";

describe("getMektekDashboardSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("aggregates operations-first dashboard metrics", async () => {
    (prismadb.crm_Accounts_Tasks.count as jest.Mock).mockResolvedValue(3);
    (prismadb.crm_Accounts_Tasks.findMany as jest.Mock).mockResolvedValue([
      {
        id: "open",
        title: "MEKTEK Service - Open",
        dueDateAt: new Date("2026-05-17T08:00:00.000Z"),
        taskStatus: "ACTIVE",
        updatedAt: new Date("2026-05-17T09:00:00.000Z"),
        createdAt: new Date("2026-05-17T07:00:00.000Z"),
        content: "",
        tags: {
          serviceItems: [{ name: "Tune up", quantity: 1, unitPrice: 100000, total: 100000 }],
          payment: { method: "cash", amountPaid: 25000, status: "partial" },
        },
      },
      {
        id: "overdue",
        title: "MEKTEK Service - Overdue",
        dueDateAt: new Date("2026-05-16T08:00:00.000Z"),
        taskStatus: "PENDING",
        updatedAt: new Date("2026-05-16T09:00:00.000Z"),
        createdAt: new Date("2026-05-16T07:00:00.000Z"),
        content: "",
        tags: {
          serviceItems: [{ name: "Repair", quantity: 1, unitPrice: 200000, total: 200000 }],
        },
      },
      {
        id: "done",
        title: "MEKTEK Service - Done",
        dueDateAt: new Date("2026-05-17T08:00:00.000Z"),
        taskStatus: "COMPLETE",
        updatedAt: new Date("2026-05-17T10:00:00.000Z"),
        createdAt: new Date("2026-05-17T07:00:00.000Z"),
        content: "",
        tags: {
          serviceItems: [{ name: "Inspection", quantity: 1, unitPrice: 50000, total: 50000 }],
          payment: { method: "cash", amountPaid: 54500, status: "paid" },
        },
      },
    ]);

    const result = await getMektekDashboardSummary(new Date("2026-05-17T12:00:00.000Z"));

    expect(result).toMatchObject({
      openOrders: 2,
      dueToday: 1,
      overdue: 1,
      completedToday: 1,
      unpaidBalance: 302000,
    });
    expect(result.recentOrders).toHaveLength(3);
    expect(result.recentOrdersPage).toBe(1);
    expect(result.recentOrdersTotalPages).toBe(1);
  });
});
