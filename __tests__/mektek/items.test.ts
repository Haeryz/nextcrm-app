import {
  appendMektekLineItems,
  haveRequiredMektekItemInputPrices,
  haveRequiredMektekItemPrices,
  mergeMektekLineItemInputs,
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

describe("haveRequiredMektekItemPrices", () => {
  it("accepts empty optional groups and items with positive prices", () => {
    expect(haveRequiredMektekItemPrices([])).toBe(true);
    expect(haveRequiredMektekItemPrices([{ unitPrice: 1 }])).toBe(true);
    expect(haveRequiredMektekItemPrices([{ unitPrice: 1_000_000 }])).toBe(true);
  });

  it("rejects missing, zero, negative, and non-finite prices", () => {
    expect(haveRequiredMektekItemPrices([{ unitPrice: 0 }])).toBe(false);
    expect(haveRequiredMektekItemPrices([{ unitPrice: -1 }])).toBe(false);
    expect(haveRequiredMektekItemPrices([{ unitPrice: Number.NaN }])).toBe(false);
  });

  it("validates raw formatted estimated-cost input values", () => {
    expect(
      haveRequiredMektekItemInputPrices([
        { estimatedCost: "1.000.000" },
        { estimatedCost: 50_000 },
      ]),
    ).toBe(true);
    expect(
      haveRequiredMektekItemInputPrices([{ estimatedCost: "" }]),
    ).toBe(false);
    expect(
      haveRequiredMektekItemInputPrices([{ estimatedCost: "0" }]),
    ).toBe(false);
    expect(
      haveRequiredMektekItemInputPrices([{ estimatedCost: "Rp -100.000" }]),
    ).toBe(false);
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

  it("merges matching service and sparepart rows by increasing quantity", () => {
    const result = appendMektekLineItems(
      {
        serviceItems: [
          { name: "Servis AC", quantity: 1, unitPrice: 125_000, total: 125_000 },
        ],
        sparepartItems: [
          { name: "Filter Oli", quantity: 2, unitPrice: 50_000, total: 100_000 },
        ],
      }, null,
      {
        serviceItems: [
          { description: "  servis ac ", quantity: 2, estimatedCost: 125_000 },
        ],
        sparepartItems: [
          { description: "FILTER OLI", quantity: 3, estimatedCost: 50_000 },
        ],
      },
    );

    expect(result.serviceItems).toEqual([
      expect.objectContaining({ name: "Servis AC", quantity: 3, total: 375_000 }),
    ]);
    expect(result.sparepartItems).toEqual([
      expect.objectContaining({ name: "Filter Oli", quantity: 5, total: 250_000 }),
    ]);
  });
});

describe("mergeMektekLineItemInputs", () => {
  it("turns repeated manual and catalog rows into quantity increments", () => {
    const result = mergeMektekLineItemInputs([
      { description: "Servis AC", quantity: 1, estimatedCost: "125000" },
      { description: " servis ac ", quantity: 2, estimatedCost: "125000" },
      {
        description: "Filter oli",
        catalogItemId: "filter-1",
        quantity: 1,
        estimatedCost: "50000",
      },
      {
        description: "Oil filter",
        catalogItemId: "filter-1",
        quantity: 3,
        estimatedCost: "50000",
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ description: "Servis AC", quantity: 3 });
    expect(result[1]).toMatchObject({ catalogItemId: "filter-1", quantity: 4 });
  });
});
