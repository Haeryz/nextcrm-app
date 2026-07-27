jest.mock("@/lib/mektek/logistics-api", () => ({
  requireMektekLogisticsApiSession: jest.fn(),
}));

const findMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prismadb: { logisticsPurchaseOrder: { findMany } },
}));

import * as XLSX from "xlsx";

import { GET } from "@/app/api/mektek/receiving/purchase-orders/export/route";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";

describe("Receiving Purchase Order Excel export route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMektekLogisticsApiSession as jest.Mock).mockResolvedValue({
      session: { user: { id: "receiving-user" } },
    });
    findMany.mockResolvedValue([
      {
        projectName: "Site Morowali",
        inputDate: new Date("2026-07-22T00:00:00.000Z"),
        dueDate: new Date("2026-07-28T00:00:00.000Z"),
        poNumber: "PO-MTL-001",
        poType: "Normal",
        supplierName: "AirFilter",
        status: "OPEN",
        items: [
          {
            partName: "Filter AC",
            orderedQuantity: 10,
            receivedQuantity: 4,
          },
        ],
      },
    ]);
  });

  it("exports every Receiving PO matching the active spreadsheet filters", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mektek/receiving/purchase-orders/export?q=filter&status=OPEN",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), {
      type: "array",
      cellStyles: true,
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Receiving"],
      { header: 1 },
    );

    expect(requireMektekLogisticsApiSession).toHaveBeenCalledWith("RECEIVING");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          flow: "RECEIVING",
          status: "OPEN",
          OR: expect.any(Array),
        }),
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "mektek-receiving-po-",
    );
    expect(workbook.SheetNames).toEqual(["Receiving", "Ringkasan"]);
    expect(rows[1]).toEqual([
      "No",
      "Job Site / Project",
      "Tanggal Create",
      "Due Date",
      "PO No. User",
      "PO Type",
      "Supplier",
      "Ringkasan Part",
      "Status",
      "QTY Masuk",
      "QTY Order",
      "QTY Sisa",
    ]);
    expect(rows[2]).toEqual([
      1,
      "Site Morowali",
      "22 Juli 2026",
      "28 Juli 2026",
      "PO-MTL-001",
      "Normal",
      "AirFilter",
      "1 part · Filter AC",
      "Open",
      4,
      10,
      6,
    ]);
  });

  it("returns the authorization response before querying data", async () => {
    (requireMektekLogisticsApiSession as jest.Mock).mockResolvedValueOnce({
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost/api/mektek/receiving/purchase-orders/export"),
    );

    expect(response.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});
