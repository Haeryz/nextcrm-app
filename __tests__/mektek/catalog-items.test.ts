jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/session", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

const tx = {
  catalogItem: {
    create: jest.fn(),
    update: jest.fn(),
  },
  catalogInventoryMonth: {
    create: jest.fn(),
  },
};

const catalogItemFindUnique = jest.fn();
const catalogItemUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    catalogItem: {
      findUnique: catalogItemFindUnique,
      update: catalogItemUpdate,
    },
  },
}));

import {
  createMektekCatalogItem,
  updateMektekCatalogItem,
} from "@/actions/mektek/catalog-items";
import { getServerSession } from "@/lib/session";

describe("catalog item inventory creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "admin", isAdmin: true, userStatus: "ACTIVE" },
    });
    tx.catalogItem.create.mockResolvedValue({ id: "compressor" });
    tx.catalogInventoryMonth.create.mockResolvedValue({ id: "month" });
    catalogItemFindUnique.mockResolvedValue({ id: "compressor" });
    catalogItemUpdate.mockResolvedValue({ id: "compressor" });
  });

  it("stores the corrected field mapping and creates the opening warehouse ledger atomically", async () => {
    const result = await createMektekCatalogItem({
      id: "compressor",
      itemName: "Compressor",
      machine: "DENSO",
      partNumber: "447220-7250",
      productionChannel: "THERMAL",
      rearLocation: "002C0601",
      frontLocation: "002D0203",
      initialRearStock: "10",
      initialFrontStock: "4",
      price: "2500000",
    });

    expect(result).toEqual({ data: { id: "compressor" } });
    expect(tx.catalogItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "compressor",
        description: "Compressor",
        machine: "DENSO",
        partNumber: "447220-7250",
        productionChannel: "THERMAL",
        rearStock: 10,
        frontStock: 4,
      }),
      select: { id: true },
    });
    expect(tx.catalogInventoryMonth.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        catalogItemId: "compressor",
        openingRearStock: 10,
        openingFrontStock: 4,
        closingRearStock: 10,
        closingFrontStock: 4,
      }),
    });
  });

  it("updates catalogue metadata without reading or overwriting legacy quantity", async () => {
    const result = await updateMektekCatalogItem("compressor", {
      itemName: "Compressor Assy",
      machine: "DENSO",
      partNumber: "447220-7250",
      productionChannel: "THERMAL",
    });

    expect(result).toEqual({ data: { id: "compressor" } });
    expect(catalogItemFindUnique).toHaveBeenCalledWith({
      where: { id: "compressor" },
      select: { id: true },
    });
    expect(catalogItemUpdate).toHaveBeenCalledWith({
      where: { id: "compressor" },
      data: expect.not.objectContaining({ quantity: expect.anything() }),
      select: { id: true },
    });
  });
});
