jest.mock("@/actions/mektek/service-order-export", () => ({
  getMektekServiceOrderExportData: jest.fn(),
}));

import * as XLSX from "xlsx";

import { getMektekServiceOrderExportData } from "@/actions/mektek/service-order-export";
import { GET } from "@/app/api/mektek/service-orders/export/route";

describe("service-order Excel export route", () => {
  it("returns all rows for the requested month in a readable workbook", async () => {
    (getMektekServiceOrderExportData as jest.Mock).mockResolvedValue({
      month: "2026-01",
      orders: [
        {
          id: "order-1",
          title: "MEKTEK Service - AC tidak dingin",
          taskStatus: "ACTIVE",
          createdAt: new Date("2026-01-10T01:00:00.000Z"),
          updatedAt: null,
          dueDateAt: null,
          content: "Periksa kompresor",
          tags: {
            customerName: "Budi",
            vehicle: "Toyota Avanza",
            vehiclePlateNumber: "B 1234 XYZ",
          },
          assigned_user: null,
        },
      ],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/mektek/service-orders/export?month=2026-01",
      ),
    );
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets[`Pesanan 2026-01`];
    const summaryWorksheet = workbook.Sheets[`Ringkasan 2026-01`];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
    const summaryRows = XLSX.utils.sheet_to_json<unknown[]>(summaryWorksheet, {
      header: 1,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "mektek-service-orders-2026-01.xlsx",
    );
    expect(workbook.SheetNames).toEqual([
      "Ringkasan 2026-01",
      "Pesanan 2026-01",
    ]);
    expect(summaryRows).toEqual(
      expect.arrayContaining([
        ["Metrik", "Nilai"],
        ["Total Pesanan", 1],
      ]),
    );
    expect(rows[0]).toEqual(
      expect.arrayContaining(["Nama Customer", "Nomor Plat", "Tanggal Masuk"]),
    );
    expect(rows[1]).toEqual(
      expect.arrayContaining(["Budi", "Toyota Avanza", "B 1234 XYZ"]),
    );
  });

  it("preserves authorization failures without generating a workbook", async () => {
    (getMektekServiceOrderExportData as jest.Mock).mockRejectedValue(
      new Error("Forbidden"),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/mektek/service-orders/export?month=2026-01",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
