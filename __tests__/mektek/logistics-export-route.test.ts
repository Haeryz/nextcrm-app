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
        status: "CLOSED",
        userName: "PT User",
        projectName: "Site B",
        inputDate: new Date("2026-07-05T00:00:00.000Z"),
        deliveryDate: new Date("2026-07-06T00:00:00.000Z"),
        items: [
          {
            orderedQuantity: 5,
            receivedQuantity: 5,
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
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
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
      "PO / Batch",
      "User / Project",
      "Tanggal",
      "Item",
      "QTY Order",
      "QTY Keluar",
      "QTY Sisa",
      "Status",
    ]);
    expect(rows[1]).toEqual([
      "PO-100 / 1 batch Barang Keluar",
      "PT User / Site B",
      "2026-07-06",
      1,
      5,
      5,
      0,
      "Closed",
    ]);
  });
});
