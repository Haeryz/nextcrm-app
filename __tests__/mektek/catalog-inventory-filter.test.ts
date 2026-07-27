import {
  filterCatalogInventorySnapshots,
  type CatalogInventorySnapshot,
} from "@/lib/mektek/catalog-inventory";

function snapshot(
  values: Partial<CatalogInventorySnapshot> &
    Pick<CatalogInventorySnapshot, "id" | "itemName">,
): CatalogInventorySnapshot {
  return {
    productionChannel: null,
    machine: "",
    partNumber: null,
    remark: null,
    rearLocation: null,
    frontLocation: null,
    openingRearStock: 0,
    openingFrontStock: 0,
    closingRearStock: 0,
    closingFrontStock: 0,
    minStock: 0,
    openingStockEditable: false,
    totalInbound: 0,
    totalOutbound: 0,
    dailyInbound: [],
    dailyMovements: [],
    ...values,
  };
}

const snapshots = [
  snapshot({
    id: "compressor",
    itemName: "Compressor",
    productionChannel: "THERMAL",
    machine: "DENSO",
    partNumber: "447220-7250",
    rearLocation: "002C0601",
    closingRearStock: 20,
    closingFrontStock: 7,
  }),
  snapshot({
    id: "gear-set",
    itemName: "Gear Set",
    productionChannel: "POWERTRAIN",
    machine: "KOMATSU",
    remark: "Slow moving",
    closingRearStock: 60,
    closingFrontStock: 50,
  }),
  snapshot({
    id: "water-pump",
    itemName: "Water Pump",
    productionChannel: "THERMAL",
    machine: "CATERPILLAR",
    frontLocation: "RACK-A1",
    closingRearStock: 50,
    closingFrontStock: 50,
  }),
];

describe("catalog inventory spreadsheet filters", () => {
  it("searches all useful text columns without matching case", () => {
    expect(
      filterCatalogInventorySnapshots(snapshots, { query: "447220" }).map(
        (item) => item.id,
      ),
    ).toEqual(["compressor"]);
    expect(
      filterCatalogInventorySnapshots(snapshots, { query: "rack-a1" }).map(
        (item) => item.id,
      ),
    ).toEqual(["water-pump"]);
  });

  it("combines channel and quantity filters like a spreadsheet", () => {
    expect(
      filterCatalogInventorySnapshots(snapshots, {
        productionChannel: "THERMAL",
        quantityField: "TOTAL_CLOSING_STOCK",
        quantityOperator: "LT",
        quantityValue: "100",
      }).map((item) => item.id),
    ).toEqual(["compressor"]);
  });

  it("supports inclusive and per-warehouse quantity comparisons", () => {
    expect(
      filterCatalogInventorySnapshots(snapshots, {
        quantityField: "TOTAL_CLOSING_STOCK",
        quantityOperator: "LTE",
        quantityValue: 100,
      }).map((item) => item.id),
    ).toEqual(["compressor", "water-pump"]);
    expect(
      filterCatalogInventorySnapshots(snapshots, {
        quantityField: "CLOSING_REAR_STOCK",
        quantityOperator: "GT",
        quantityValue: 50,
      }).map((item) => item.id),
    ).toEqual(["gear-set"]);
  });

  it("ignores an empty quantity value", () => {
    expect(
      filterCatalogInventorySnapshots(snapshots, {
        quantityField: "TOTAL_CLOSING_STOCK",
        quantityOperator: "LT",
        quantityValue: "",
      }),
    ).toHaveLength(3);
  });
});
