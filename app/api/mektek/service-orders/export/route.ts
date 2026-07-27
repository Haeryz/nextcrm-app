import * as XLSX from "xlsx";

import { getMektekServiceOrderExportData } from "@/actions/mektek/service-order-export";
import {
  buildMektekServiceOrderExportRows,
  buildMektekServiceOrderExportSummary,
  MEKTEK_SERVICE_ORDER_EXPORT_HEADERS,
} from "@/lib/mektek/service-order-export";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? undefined;
    const data = await getMektekServiceOrderExportData(month, request);
    const rows = buildMektekServiceOrderExportRows(data.orders);
    const summaryRows = buildMektekServiceOrderExportSummary(rows, data.month);
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...MEKTEK_SERVICE_ORDER_EXPORT_HEADERS],
    });
    worksheet["!cols"] = MEKTEK_SERVICE_ORDER_EXPORT_HEADERS.map((header) => ({
      wch: Math.max(14, Math.min(36, header.length + 6)),
    }));
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows);
    summaryWorksheet["!cols"] = [{ wch: 28 }, { wch: 20 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      summaryWorksheet,
      `Ringkasan ${data.month}`,
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, `Pesanan ${data.month}`);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mektek-service-orders-${data.month}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Forbidden") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.startsWith("Bulan export")) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.log("[EXPORT_MEKTEK_SERVICE_ORDERS]", error);
    return Response.json({ error: "Gagal export order" }, { status: 500 });
  }
}
