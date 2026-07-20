import * as XLSX from "xlsx";

import { getMektekServiceOrderExportData } from "@/actions/mektek/service-order-export";
import {
  buildMektekServiceOrderExportRows,
  MEKTEK_SERVICE_ORDER_EXPORT_HEADERS,
} from "@/lib/mektek/service-order-export";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? undefined;
    const data = await getMektekServiceOrderExportData(month);
    const rows = buildMektekServiceOrderExportRows(data.orders);
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...MEKTEK_SERVICE_ORDER_EXPORT_HEADERS],
    });
    worksheet["!cols"] = MEKTEK_SERVICE_ORDER_EXPORT_HEADERS.map((header) => ({
      wch: Math.max(14, Math.min(36, header.length + 6)),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Servis ${data.month}`);
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
