jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/mektek/permissions", () => ({
  canManageMektekCatalog: jest.fn(() => true),
}));

const catalogItemFindMany = jest.fn();
const inventoryMonthFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    catalogItem: {
      count: jest.fn().mockResolvedValue(1),
      findMany: catalogItemFindMany,
    },
    catalogInventoryMonth: {
      findMany: inventoryMonthFindMany,
    },
  },
}));

import { listMektekCatalogInventoryItems } from "@/actions/mektek/catalog-inventory";
import { getServerSession } from "@/lib/session";

describe("catalog inventory month snapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin" },
    });
    catalogItemFindMany
      .mockResolvedValueOnce([{ machine: "DENSO" }])
      .mockResolvedValueOnce([
        {
          id: "compressor",
          machine: "DENSO",
          imagePath: null,
          imageMimeType: null,
          partNumber: "447220-7250",
          description: "Compressor",
          price: null,
          productionChannel: "THERMAL",
          rearLocation: null,
          frontLocation: null,
          rearStock: 20,
          frontStock: 5,
          remark: null,
        },
      ]);
    inventoryMonthFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { catalogItemId: "compressor", month: new Date("2026-07-01T00:00:00Z") },
      ]);
  });

  it("shows zero stock for a month before inventory tracking started", async () => {
    const result = await listMektekCatalogInventoryItems({ month: "2026-06" });

    expect(result.items[0].inventory).toEqual(
      expect.objectContaining({
        openingRearStock: 0,
        openingFrontStock: 0,
        closingRearStock: 0,
        closingFrontStock: 0,
      }),
    );
  });
});
