import {
  appendMektekLineItems,
  normalizeMektekLineItems,
} from "@/lib/mektek/items";

describe("normalizeMektekLineItems", () => {
  it("keeps new split arrays separate", () => {
    const result = normalizeMektekLineItems({
      serviceItems: [
        {
          name: "Tune up",
          quantity: 1,
          unitPrice: 150000,
          total: 150000,
        },
      ],
      sparepartItems: [
        {
          name: "Oil filter",
          quantity: 2,
          unitPrice: 50000,
          total: 100000,
          catalogItemId: "part-1",
        },
      ],
    });

    expect(result.serviceItems).toHaveLength(1);
    expect(result.sparepartItems).toHaveLength(1);
    expect(result.serviceSubtotal).toBe(150000);
    expect(result.sparepartSubtotal).toBe(100000);
    expect(result.subtotal).toBe(250000);
  });

  it("maps legacy catalog-backed items to spareparts and manual items to services", () => {
    const result = normalizeMektekLineItems({
      items: [
        {
          name: "Inspection",
          quantity: 1,
          unitPrice: 75000,
          total: 75000,
        },
        {
          name: "Cabin filter",
          quantity: 1,
          unitPrice: 90000,
          total: 90000,
          catalogItemId: "catalog-1",
        },
      ],
    });

    expect(result.serviceItems.map((item) => item.name)).toEqual(["Inspection"]);
    expect(result.sparepartItems.map((item) => item.name)).toEqual(["Cabin filter"]);
    expect(result.subtotal).toBe(165000);
  });
});

describe("appendMektekLineItems", () => {
  it("appends new service and sparepart rows and recalculates both subtotals", () => {
    const result = appendMektekLineItems(
      {
        serviceItems: [
          { name: "Inspection", quantity: 1, unitPrice: 75_000, total: 75_000 },
        ],
        sparepartItems: [
          { name: "Filter", quantity: 1, unitPrice: 50_000, total: 50_000 },
        ],
      },
      null,
      {
        serviceItems: [
          { description: "AC service", quantity: 1, estimatedCost: 125_000 },
        ],
        sparepartItems: [
          { description: "Belt", quantity: 2, estimatedCost: 80_000 },
        ],
      },
    );

    expect(result.serviceItems.map((item) => item.name)).toEqual([
      "Inspection",
      "AC service",
    ]);
    expect(result.sparepartItems.map((item) => item.name)).toEqual([
      "Filter",
      "Belt",
    ]);
    expect(result.serviceSubtotal).toBe(200_000);
    expect(result.sparepartSubtotal).toBe(210_000);
    expect(result.subtotal).toBe(410_000);
  });
});
