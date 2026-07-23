import * as XLSX from "xlsx";

import {
  buildLogisticsPoExportRows,
  getLogisticsPoExportRange,
  LOGISTICS_PO_EXPORT_HEADERS,
} from "@/lib/mektek/logistics-export";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireMektekLogisticsApiSession("MONITORING_PO");
  if (access.response) return access.response;
  const searchParams = new URL(request.url).searchParams;
  const fromMonth = searchParams.get("fromMonth") ?? "";
  const toMonth = searchParams.get("toMonth") ?? "";

  try {
    const range = getLogisticsPoExportRange(fromMonth, toMonth);
    const orders = await prismadb.logisticsPurchaseOrder.findMany({
      where: {
        flow: "OUTBOUND",
        inputDate: { gte: range.start, lt: range.end },
      },
      orderBy: [{ inputDate: "asc" }, { poNumber: "asc" }],
      select: {
        poNumber: true,
        status: true,
        userName: true,
        projectName: true,
        inputDate: true,
        deliveryDate: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            partName: true,
            partNumber: true,
            orderedQuantity: true,
            receivedQuantity: true,
            receipts: { select: { receivingReference: true } },
          },
        },
      },
    });
    const rows = buildLogisticsPoExportRows(orders);
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...LOGISTICS_PO_EXPORT_HEADERS],
    });
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 24 },
      { wch: 30 },
      { wch: 30 },
      { wch: 14 },
      { wch: 30 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
    ];
    const summary = XLSX.utils.json_to_sheet([
      { Ringkasan: "Periode", Nilai: `${range.fromMonth} s.d. ${range.toMonth}` },
      { Ringkasan: "Jumlah PO", Nilai: orders.length },
      { Ringkasan: "Jumlah baris item", Nilai: rows.length },
      {
        Ringkasan: "Total QTY Order",
        Nilai: rows.reduce((sum, row) => sum + Number(row["QTY Order"] || 0), 0),
      },
      {
        Ringkasan: "Total QTY Keluar",
        Nilai: rows.reduce((sum, row) => sum + Number(row["QTY Keluar"] || 0), 0),
      },
      {
        Ringkasan: "Total QTY Sisa",
        Nilai: rows.reduce((sum, row) => sum + Number(row["QTY Sisa"] || 0), 0),
      },
    ]);
    summary["!cols"] = [{ wch: 24 }, { wch: 24 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Monitoring PO");
    XLSX.utils.book_append_sheet(workbook, summary, "Ringkasan");
    const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mektek-monitoring-po-${range.fromMonth}-${range.toMonth}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const isRangeValidationError =
      error instanceof Error && /^(Bulan|Rentang export)/.test(error.message);
    if (!isRangeValidationError) {
      console.log("[EXPORT_MEKTEK_OUTBOUND_PO]", error);
    }
    return Response.json(
      {
        error: isRangeValidationError
          ? error.message
          : "Gagal export Monitoring PO",
      },
      { status: isRangeValidationError ? 400 : 500 },
    );
  }
}
