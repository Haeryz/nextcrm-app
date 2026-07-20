import * as XLSX from "xlsx";

import { getMektekCatalogInventoryExportData } from "@/actions/mektek/catalog-inventory";
import { buildCatalogInventoryExportTable } from "@/lib/mektek/catalog-inventory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? undefined;

  try {
    const inventory = await getMektekCatalogInventoryExportData(month);
    const table = buildCatalogInventoryExportTable(
      inventory.snapshots,
      inventory.month,
    );
    const worksheet = XLSX.utils.json_to_sheet(table.rows, {
      header: table.headers,
    });
    worksheet["!cols"] = table.headers.map((header) => ({
      wch: header.startsWith("Tanggal ")
        ? 10
        : header === "Item Name"
          ? 32
          : header.includes("Lokasi")
            ? 20
            : 18,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `Stok ${inventory.month}`,
    );
    const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mektek-sparepart-stock-${inventory.month}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengekspor inventory";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;
    return Response.json({ error: message }, { status });
  }
}
