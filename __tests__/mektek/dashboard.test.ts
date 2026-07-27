jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Accounts_Tasks: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    catalogItem: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { getMektekDashboardSummary } from "@/actions/mektek/dashboard";

describe("getMektekDashboardSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The action now authorizes independently: admin + ACTIVE session required.
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin1", isAdmin: true, mektekRole: null, userStatus: "ACTIVE" },
    });
    (prismadb.catalogItem.findMany as jest.Mock).mockResolvedValue([]);
  });

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
      unpaidBalance: 275000,
    });
    expect(result.recentOrders).toHaveLength(3);
    expect(result.recentOrdersPage).toBe(1);
    expect(result.recentOrdersTotalPages).toBe(1);
    expect(result.itemActivity).toEqual({ newestItems: [], quantityUpdates: [] });
  });

  it("throws for a non-admin session without Customer Service capability (item 22)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "logistics1",
        isAdmin: false,
        mektekRole: null,
        staffCapabilities: ["MEKTEK_CATALOG"],
        userStatus: "ACTIVE",
      },
    });
    await expect(getMektekDashboardSummary()).rejects.toThrow("Forbidden");
    expect(prismadb.crm_Accounts_Tasks.findMany).not.toHaveBeenCalled();
  });

  it("throws for a suspended admin session (item 23)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin1", isAdmin: true, mektekRole: null, userStatus: "INACTIVE" },
    });
    await expect(getMektekDashboardSummary()).rejects.toThrow("Forbidden");
  });
});
