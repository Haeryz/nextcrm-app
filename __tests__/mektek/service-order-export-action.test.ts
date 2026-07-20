jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canAccessMektekStaffArea: jest.fn(() => true),
}));

const findMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Accounts_Tasks: { findMany },
  },
}));

import { getMektekServiceOrderExportData } from "@/actions/mektek/service-order-export";
import { getServerSession } from "@/lib/session";

describe("service-order export query", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "admin" } });
    findMany.mockResolvedValue([]);
  });

  it("queries the complete Makassar month without pagination", async () => {
    await getMektekServiceOrderExportData("2026-01");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2025-12-31T16:00:00.000Z"),
            lt: new Date("2026-01-31T16:00:00.000Z"),
          },
        }),
      }),
    );
    const query = findMany.mock.calls[0][0];
    expect(query).not.toHaveProperty("skip");
    expect(query).not.toHaveProperty("take");
  });
});
