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

  it("exports one unmerged Riwayat Monitoring PO row per item", () => {
    expect(LOGISTICS_PO_EXPORT_HEADERS).toEqual([
      "No",
      "PO",
      "Batch",
      "User",
      "Project",
      "Tanggal",
      "Item Name",
      "Kode Barang",
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
            partName: "Thermostat",
            partNumber: "ND077500-2580",
            orderedQuantity: 2,
            receivedQuantity: 1,
            receipts: [
              { receivingReference: "OUT-1" },
              { receivingReference: "OUT-2" },
            ],
          },
          {
            partName: "Snap Ring",
            partNumber: "146300-5010",
            orderedQuantity: 1,
            receivedQuantity: 1,
            receipts: [{ receivingReference: "OUT-1" }],
          },
          {
            partName: "Aselole",
            partNumber: null,
            orderedQuantity: 4,
            receivedQuantity: 0,
            receipts: [],
          },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        No: 1,
        PO: "PO-10",
        Batch: "2 batch Barang Keluar",
        User: "PT User",
        Project: "Site A",
        Tanggal: "2026-07-12",
        "Item Name": "Thermostat",
        "Kode Barang": "ND077500-2580",
        "QTY Order": 2,
        "QTY Keluar": 1,
        "QTY Sisa": 1,
        Status: "Open",
      },
      {
        No: "",
        PO: "PO-10",
        Batch: "2 batch Barang Keluar",
        User: "PT User",
        Project: "Site A",
        Tanggal: "2026-07-12",
        "Item Name": "Snap Ring",
        "Kode Barang": "146300-5010",
        "QTY Order": 1,
        "QTY Keluar": 1,
        "QTY Sisa": 0,
        Status: "Open",
      },
      {
        No: "",
        PO: "PO-10",
        Batch: "2 batch Barang Keluar",
        User: "PT User",
        Project: "Site A",
        Tanggal: "2026-07-12",
        "Item Name": "Aselole",
        "Kode Barang": "",
        "QTY Order": 4,
        "QTY Keluar": 0,
        "QTY Sisa": 4,
        Status: "Open",
      },
    ]);
  });
});
