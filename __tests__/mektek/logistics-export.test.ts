import {
  buildLogisticsPoExportRows,
  getLogisticsPoExportRange,
  LOGISTICS_PO_EXPORT_HEADERS,
} from "@/lib/mektek/logistics-export";

describe("Monitoring PO monthly export", () => {
  it("returns a half-open UTC range for a selected month span", () => {
    expect(getLogisticsPoExportRange("2026-05", "2026-07")).toEqual({
      fromMonth: "2026-05",
      toMonth: "2026-07",
      start: new Date("2026-05-01T00:00:00.000Z"),
      end: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it.each([
    ["2026-13", "2026-13", "Bulan awal export tidak valid"],
    ["2026-08", "2026-07", "Bulan awal export tidak boleh setelah bulan akhir"],
    ["2023-01", "2026-01", "Rentang export maksimal 36 bulan"],
  ])("rejects an invalid range", (fromMonth, toMonth, message) => {
    expect(() => getLogisticsPoExportRange(fromMonth, toMonth)).toThrow(message);
  });

  it("exports one Riwayat Monitoring PO row per created PO", () => {
    expect(LOGISTICS_PO_EXPORT_HEADERS).toEqual([
      "PO / Batch",
      "User / Project",
      "Tanggal",
      "Item",
      "QTY Order",
      "QTY Keluar",
      "QTY Sisa",
      "Status",
    ]);

    const rows = buildLogisticsPoExportRows([
      {
        poNumber: "PO-10",
        status: "OPEN",
        userName: "PT User",
        projectName: "Site A",
        inputDate: new Date("2026-07-12T00:00:00.000Z"),
        deliveryDate: null,
        items: [
          {
            orderedQuantity: 2,
            receivedQuantity: 1,
            receipts: [
              { receivingReference: "OUT-1" },
              { receivingReference: "OUT-2" },
            ],
          },
          {
            orderedQuantity: 1,
            receivedQuantity: 1,
            receipts: [{ receivingReference: "OUT-1" }],
          },
          {
            orderedQuantity: 4,
            receivedQuantity: 0,
            receipts: [],
          },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        "PO / Batch": "PO-10 / 2 batch Barang Keluar",
        "User / Project": "PT User / Site A",
        Tanggal: "2026-07-12",
        Item: 3,
        "QTY Order": 7,
        "QTY Keluar": 2,
        "QTY Sisa": 5,
        Status: "Open",
      },
    ]);
  });
});
