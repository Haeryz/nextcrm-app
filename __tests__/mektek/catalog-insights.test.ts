import {
  buildCatalogHighlights,
  buildQuantityUpdateData,
  formatQuantityChange,
} from "@/lib/mektek/catalog-insights";

describe("catalog item insights", () => {
  it("prioritizes real best sellers and fills remaining highlights with newest items", () => {
    const catalogItems = [
      {
        id: "newest",
        machine: "PC200",
        description: "Newest seal",
        partNumber: "NS-1",
        quantity: "8",
        price: 125_000,
        imagePath: null,
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
      },
      {
        id: "best-seller",
        machine: "PC300",
        description: "Popular filter",
        partNumber: "PF-2",
        quantity: "4",
        price: 250_000,
        imagePath: "/filter.jpg",
        createdAt: new Date("2026-07-01T08:00:00.000Z"),
      },
      {
        id: "older",
        machine: "PC100",
        description: "Older hose",
        partNumber: null,
        quantity: "2",
        price: 90_000,
        imagePath: null,
        createdAt: new Date("2026-06-01T08:00:00.000Z"),
      },
    ];

    const result = buildCatalogHighlights(catalogItems, [
      { catalogItemId: "best-seller", quantity: 12 },
      { catalogItemId: "missing-item", quantity: 99 },
    ]);

    expect(result.popular.map((item) => item.id)).toEqual(["best-seller"]);
    expect(result.popular[0]).toMatchObject({ soldQuantity: 12 });
    expect(result.newest.map((item) => item.id)).toEqual([
      "newest",
      "best-seller",
      "older",
    ]);
  });

  it("describes quantity changes without assuming numeric inventory", () => {
    expect(formatQuantityChange("3", "8")).toBe("3 → 8");
    expect(formatQuantityChange(null, "Ready stock")).toBe(
      "Belum diisi → Ready stock",
    );
  });

  it("only stamps an inventory update when the quantity actually changes", () => {
    const changedAt = new Date("2026-07-20T12:00:00.000Z");
    expect(buildQuantityUpdateData("3", "8", changedAt)).toEqual({
      previousQuantity: "3",
      quantityUpdatedAt: changedAt,
    });
    expect(buildQuantityUpdateData("3", "3", changedAt)).toEqual({});
    expect(buildQuantityUpdateData(null, "", changedAt)).toEqual({});
  });
});
