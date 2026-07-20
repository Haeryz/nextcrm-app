jest.mock("@/actions/mektek/catalog-inventory", () => ({
  getMektekCatalogInventoryExportData: jest.fn(),
}));

import * as XLSX from "xlsx";

import { getMektekCatalogInventoryExportData } from "@/actions/mektek/catalog-inventory";
import { GET } from "@/app/api/mektek/catalog-inventory/export/route";

describe("catalog inventory Excel export route", () => {
  it("returns a readable monthly workbook with dynamic date columns", async () => {
    (getMektekCatalogInventoryExportData as jest.Mock).mockResolvedValue({
      month: "2026-07",
      snapshots: [
        {
          id: "compressor",
          itemName: "Compressor",
          productionChannel: "THERMAL",
          machine: "DENSO",
          partNumber: "447220-7250",
          remark: null,
          rearLocation: "002C0601",
          frontLocation: "002D0203",
          openingRearStock: 10,
          openingFrontStock: 4,
          closingRearStock: 20,
          closingFrontStock: 7,
          openingStockEditable: false,
          totalInbound: 15,
          dailyInbound: Array.from({ length: 31 }, (_, index) => ({
            day: index + 1,
            rear: index === 4 ? 12 : 0,
            front: index === 4 ? 3 : 0,
            total: index === 4 ? 15 : 0,
          })),
        },
      ],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/mektek/catalog-inventory/export?month=2026-07",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "mektek-sparepart-stock-2026-07.xlsx",
    );
    expect(rows[0]).toEqual(
      expect.arrayContaining([
        "Item Name",
        "Production Channel",
        "Tanggal 31",
        "Lokasi G. Belakang",
        "Lokasi G. Depan",
      ]),
    );
    expect(rows[1]).toEqual(expect.arrayContaining(["Compressor", "Thermal"]));
  });
});
