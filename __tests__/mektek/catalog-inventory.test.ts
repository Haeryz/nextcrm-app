import {
  buildCatalogInventoryExportTable,
  calculateCatalogInventoryMonth,
  getCatalogInventoryMonthRange,
  parseCatalogInventoryDateKey,
  rolloverCatalogInventoryMonth,
  type CatalogInventorySnapshot,
} from "@/lib/mektek/catalog-inventory";

describe("catalog inventory month", () => {
  it("tracks rear/front warehouses independently and recaps inbound and outbound stock per date", () => {
    const january = calculateCatalogInventoryMonth({
      month: "2026-01",
      openingRearStock: 10,
      openingFrontStock: 4,
      movements: [
        {
          warehouse: "REAR",
          direction: "IN",
          quantity: 12,
          occurredAt: new Date("2026-01-05T12:00:00.000Z"),
        },
        {
          warehouse: "REAR",
          direction: "OUT",
          quantity: 2,
          occurredAt: new Date("2026-01-20T12:00:00.000Z"),
        },
        {
          warehouse: "FRONT",
          direction: "IN",
          quantity: 3,
          occurredAt: new Date("2026-01-05T12:00:00.000Z"),
        },
      ],
    });

    expect(january).toMatchObject({
      openingRearStock: 10,
      openingFrontStock: 4,
      closingRearStock: 20,
      closingFrontStock: 7,
      totalInbound: 15,
      totalOutbound: 2,
    });
    expect(january.dailyInbound[4]).toEqual({
      day: 5,
      rear: 12,
      front: 3,
      total: 15,
    });
    expect(january.dailyMovements[4]).toEqual({
      day: 5,
      inbound: { rear: 12, front: 3, total: 15 },
      outbound: { rear: 0, front: 0, total: 0 },
    });
    expect(january.dailyMovements[19]).toEqual({
      day: 20,
      inbound: { rear: 0, front: 0, total: 0 },
      outbound: { rear: 2, front: 0, total: 2 },
    });
  });

  it("rolls one month's closing stock into the next month's opening stock", () => {
    const februaryOpening = rolloverCatalogInventoryMonth({
      closingRearStock: 20,
      closingFrontStock: 7,
    });

    expect(februaryOpening).toEqual({
      openingRearStock: 20,
      openingFrontStock: 7,
    });
  });

  it("uses the real number of calendar days, including leap-year February", () => {
    expect(getCatalogInventoryMonthRange("2024-02").daysInMonth).toBe(29);
    expect(getCatalogInventoryMonthRange("2026-02").daysInMonth).toBe(28);
    expect(getCatalogInventoryMonthRange("2026-07").daysInMonth).toBe(31);
    expect(() => parseCatalogInventoryDateKey("2026-02-31")).toThrow(
      "Tanggal mutasi tidak valid",
    );
  });
});

describe("catalog inventory export", () => {
  const snapshot: CatalogInventorySnapshot = {
    id: "compressor",
    itemName: "Compressor",
    productionChannel: "THERMAL",
    machine: "DENSO",
    partNumber: "447220-7250",
    remark: "Fast moving",
    rearLocation: "002C0601",
    frontLocation: "002D0203",
    openingRearStock: 10,
    openingFrontStock: 4,
    closingRearStock: 20,
    closingFrontStock: 7,
    minStock: 0,
    openingStockEditable: true,
    totalInbound: 15,
    totalOutbound: 2,
    dailyInbound: Array.from({ length: 31 }, (_, index) => ({
      day: index + 1,
      rear: index === 4 ? 12 : 0,
      front: index === 4 ? 3 : 0,
      total: index === 4 ? 15 : 0,
    })),
    dailyMovements: Array.from({ length: 31 }, (_, index) => ({
      day: index + 1,
      inbound: {
        rear: index === 4 ? 12 : 0,
        front: index === 4 ? 3 : 0,
        total: index === 4 ? 15 : 0,
      },
      outbound: {
        rear: index === 19 ? 2 : 0,
        front: 0,
        total: index === 19 ? 2 : 0,
      },
    })),
  };

  it("creates one date column for every day in the requested month", () => {
    const july = buildCatalogInventoryExportTable([snapshot], "2026-07");
    const february = buildCatalogInventoryExportTable(
      [{
        ...snapshot,
        dailyInbound: snapshot.dailyInbound.slice(0, 28),
        dailyMovements: snapshot.dailyMovements.slice(0, 28),
      }],
      "2026-02",
    );

    expect(july.headers).toContain("Tanggal 31");
    expect(february.headers).toContain("Tanggal 28");
    expect(february.headers).not.toContain("Tanggal 29");
    expect(july.rows[0]).toMatchObject({
      "Item Name": "Compressor",
      "Production Channel": "Thermal",
      "Tanggal 5": 15,
      "Tanggal 20": "-2",
      "Total Keluar": 2,
      "Stok Akhir G. Belakang": 20,
      "Stok Akhir G. Depan": 7,
    });
  });
});
