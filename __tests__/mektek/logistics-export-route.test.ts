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

const order = {
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
      receipts: [
        {
          receivingReference: "SJ-100",
          quantity: 5,
          receivedAt: new Date("2026-07-06T00:00:00.000Z"),
          createdAt: new Date("2026-07-06T01:00:00.000Z"),
        },
      ],
    },
    {
      partName: "Snap Ring",
      partNumber: "146300-5010",
      orderedQuantity: 2,
      receivedQuantity: 1,
      receipts: [
        {
          receivingReference: "SJ-100",
          quantity: 1,
          receivedAt: new Date("2026-07-06T00:00:00.000Z"),
          createdAt: new Date("2026-07-06T01:01:00.000Z"),
        },
      ],
    },
  ],
};

describe("Monitoring PO Excel export route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([order]);
    (requireMektekLogisticsApiSession as jest.Mock).mockResolvedValue({
      session: { user: { id: "logistics-id" } },
    });
  });

  it("exports SJ Bulanan grouped by delivery-note number", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mektek/logistics/purchase-orders/export?type=delivery-note&month=2026-07",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), {
      type: "array",
      cellStyles: true,
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["SJ Bulanan"],
      { header: 1 },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "mektek-monitoring-po-sj-2026-07.xlsx",
    );
    expect(workbook.SheetNames).toEqual(["SJ Bulanan", "Ringkasan"]);
    expect(rows[0]).toEqual(["SJ Bulanan"]);
    expect(rows[1]).toEqual([
      "No SJ",
      "Tanggal",
      "Due Date",
      "Status",
      "PO",
      "Batch",
      "User/Perusahaan",
      "Project",
      "Item Name",
      "Kode Barang",
      "PO Class",
      "QTY Order",
      "QTY Keluar",
      "QTY Sisa",
    ]);
    expect(rows[2]).toEqual([
      "SJ-100",
      "6 Juli 2026",
      "20 Juli 2026",
      "Open",
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
    ]);
    expect(rows[3]).toEqual([
      "",
      "",
      "",
      "",
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
    ]);
    expect(workbook.Sheets["SJ Bulanan"]["!merges"]).toEqual([
      { s: { c: 0, r: 0 }, e: { c: 13, r: 0 } },
    ]);
    expect(workbook.Sheets["SJ Bulanan"].A3.s?.fgColor?.rgb).toContain(
      "FCE4D6",
    );
    expect(workbook.Sheets["SJ Bulanan"].N4.s?.fgColor?.rgb).toContain(
      "FCE4D6",
    );
  });

  it("exports Recap PO Bulanan with numbering grouped by PO", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/mektek/logistics/purchase-orders/export?type=purchase-order&month=2026-07",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), {
      type: "array",
      cellStyles: true,
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Recap PO Bulanan"],
      { header: 1 },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "mektek-monitoring-po-po-2026-07.xlsx",
    );
    expect(workbook.SheetNames).toEqual(["Recap PO Bulanan", "Ringkasan"]);
    expect(rows[0]).toEqual(["Recap PO Bulanan"]);
    expect(rows[1]).toEqual([
      "No",
      "User/Perusahaan",
      "PO",
      "Batch",
      "Project",
      "Item Name",
      "Kode Barang",
      "PO Class",
      "QTY Order",
      "QTY Keluar",
      "QTY Sisa",
      "Status",
    ]);
    expect(rows[2]).toEqual([
      1,
      "PT User",
      "PO-100",
      "1 batch Barang Keluar",
      "Site B",
      "Thermostat",
      "ND077500-2580",
      "Normal",
      5,
      5,
      0,
      "Open",
    ]);
    expect(rows[3]?.[0]).toBe("");
    expect(rows[3]?.[2]).toBe("PO-100");
    expect(rows[3]?.[5]).toBe("Snap Ring");
  });
});
