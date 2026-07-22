import {
  buildLogisticsPoExportRows,
  getLogisticsPoExportRange,
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

  it("exports one ordered row per outbound item with its own note", () => {
    const rows = buildLogisticsPoExportRows([
      {
        poNumber: "PO-10",
        deliveryNoteNumber: "SJ-PO-10",
        status: "OPEN",
        userName: "PT User",
        projectName: "Site A",
        inputDate: new Date("2026-07-12T00:00:00.000Z"),
        dueDate: new Date("2026-07-20T00:00:00.000Z"),
        poType: "Normal",
        notes: "Catatan header",
        items: [
          {
            position: 2,
            partName: "Item B",
            partNumber: null,
            warehouse: "FRONT",
            orderedQuantity: 2,
            receivedQuantity: 1,
            note: "Keterangan B",
          },
          {
            position: 1,
            partName: "Item A",
            partNumber: "A-1",
            warehouse: "REAR",
            orderedQuantity: 1,
            receivedQuantity: 1,
            note: "Keterangan A",
          },
          {
            position: 3,
            partName: "Item Manual",
            partNumber: "MAN-01",
            warehouse: null,
            orderedQuantity: 4,
            receivedQuantity: 0,
            note: "Tidak terhubung Catalog",
          },
        ],
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.Item)).toEqual([
      "Item A",
      "Item B",
      "Item Manual",
    ]);
    expect(rows.map((row) => row["Keterangan Item"])).toEqual([
      "Keterangan A",
      "Keterangan B",
      "Tidak terhubung Catalog",
    ]);
    expect(rows[1]).toMatchObject({
      Gudang: "Gudang Depan",
      "Part Number": "-",
      "QTY Order": 2,
      "QTY Keluar": 1,
      "QTY Sisa": 1,
    });
    expect(rows[2]).toMatchObject({ Gudang: "-", "Part Number": "MAN-01" });
  });
});
