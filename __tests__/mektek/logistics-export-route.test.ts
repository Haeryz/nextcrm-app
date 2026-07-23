jest.mock("@/lib/mektek/logistics-api", () => ({
  requireMektekLogisticsApiSession: jest.fn(),
}));

const findMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prismadb: { logisticsPurchaseOrder: { findMany } },
}));

import * as XLSX from "xlsx";

import { GET } from "@/app/api/mektek/logistics/purchase-orders/export/route";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";

describe("Monitoring PO Excel export route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMektekLogisticsApiSession as jest.Mock).mockResolvedValue({
      session: { user: { id: "logistics-id" } },
    });
  });

  it("opens with the Riwayat Monitoring PO table and its exact columns", async () => {
    findMany.mockResolvedValue([
      {
        poNumber: "PO-100",
        status: "OPEN",
        userName: "PT User",
        projectName: "Site B",
        inputDate: new Date("2026-07-05T00:00:00.000Z"),
        dueDate: new Date("2026-07-20T00:00:00.000Z"),
        deliveryDate: new Date("2026-07-06T00:00:00.000Z"),
        poType: "Normal",
        items: [
          {
            partName: "Thermostat",
            partNumber: "ND077500-2580",
            orderedQuantity: 5,
            receivedQuantity: 5,
            receipts: [{ receivingReference: "OUT-100" }],
          },
          {
            partName: "Snap Ring",
            partNumber: "146300-5010",
            orderedQuantity: 2,
            receivedQuantity: 1,
            receipts: [{ receivingReference: "OUT-100" }],
          },
        ],
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/mektek/logistics/purchase-orders/export?fromMonth=2026-07&toMonth=2026-07",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), {
      type: "array",
      cellStyles: true,
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Riwayat Monitoring PO"],
      { header: 1 },
    );

    expect(response.status).toBe(200);
    expect(workbook.SheetNames).toEqual([
      "Riwayat Monitoring PO",
      "Ringkasan",
    ]);
    expect(rows[0]).toEqual([
      "No",
      "Tanggal",
      "Due Date",
      "Nomor Surat Jalan",
      "PO",
      "Batch",
      "User",
      "Project",
      "Item Name",
      "Kode Barang",
      "PO Class (Normal/Consignment)",
      "QTY Order",
      "QTY Keluar",
      "QTY Sisa",
      "Status",
    ]);
    expect(rows[1]).toEqual([
      1,
      "2026-07-05",
      "2026-07-20",
      "OUT-100",
      "PO-100",
      "1 batch Barang Keluar",
      "PT User",
      "Site B",
      "Thermostat",
      "ND077500-2580",
      "Normal",
      5,
      5,
      0,
      "Open",
    ]);
    expect(rows[2]).toEqual([
      "",
      "2026-07-05",
      "2026-07-20",
      "OUT-100",
      "PO-100",
      "1 batch Barang Keluar",
      "PT User",
      "Site B",
      "Snap Ring",
      "146300-5010",
      "Normal",
      2,
      1,
      1,
      "Open",
    ]);
    expect(workbook.Sheets["Riwayat Monitoring PO"]["!merges"]).toBeUndefined();
    expect(
      workbook.Sheets["Riwayat Monitoring PO"].A2.s?.fgColor?.rgb,
    ).toContain("FCE4D6");
    expect(
      workbook.Sheets["Riwayat Monitoring PO"].O2.s?.fgColor?.rgb,
    ).toContain("FCE4D6");
  });
});
