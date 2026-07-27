import * as XLSX from "xlsx";

import {
  getMektekCatalogInventoryAnnualExportData,
  getMektekCatalogInventoryExportData,
} from "@/actions/mektek/catalog-inventory";
import {
  buildCatalogInventoryAnnualExportTable,
  buildCatalogInventoryExportTable,
  getCatalogInventoryMonthRange,
} from "@/lib/mektek/catalog-inventory";

export const dynamic = "force-dynamic";

function parseMonthSpan(fromMonth: string, toMonth: string) {
  const from = getCatalogInventoryMonthRange(fromMonth);
  const to = getCatalogInventoryMonthRange(toMonth);
  const fromIndex = from.year * 12 + from.monthNumber - 1;
  const toIndex = to.year * 12 + to.monthNumber - 1;
  if (fromIndex > toIndex) {
    throw new Error("Bulan awal export tidak boleh setelah bulan akhir");
  }
  if (toIndex - fromIndex > 35) {
    throw new Error("Rentang export maksimal 36 bulan");
  }
  const months: string[] = [];
  for (let i = fromIndex; i <= toIndex; i += 1) {
    const y = Math.floor(i / 12);
    const m = i - y * 12 + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return { fromMonth: from.month, toMonth: to.month, months };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const year = searchParams.get("year") ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  const fromMonth = searchParams.get("fromMonth") ?? "";
  const toMonth = searchParams.get("toMonth") ?? "";

  try {
    if (year) {
      const annual = await getMektekCatalogInventoryAnnualExportData(
        year,
        request,
      );
      const table = buildCatalogInventoryAnnualExportTable(
        annual.snapshots,
        annual.year,
      );
      const worksheet = XLSX.utils.json_to_sheet(table.rows, {
        header: table.headers,
      });
      worksheet["!cols"] = table.headers.map((header) => ({
        wch:
          header === "Item Name"
            ? 32
            : header === "Production Channel" ||
                header === "Machine" ||
                header === "Part Number" ||
                header === "Remark"
              ? 18
              : 14,
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Stok ${annual.year}`);
      const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="mektek-sparepart-stock-${annual.year}.xlsx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (fromMonth || toMonth) {
      const span = parseMonthSpan(
        fromMonth || toMonth,
        toMonth || fromMonth,
      );
      const workbook = XLSX.utils.book_new();
      for (const monthKey of span.months) {
        const inventory = await getMektekCatalogInventoryExportData(
          monthKey,
          request,
        );
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
        XLSX.utils.book_append_sheet(workbook, worksheet, `Stok ${inventory.month}`);
      }
      const periodLabel =
        span.fromMonth === span.toMonth
          ? span.fromMonth
          : `${span.fromMonth}_${span.toMonth}`;
      const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="mektek-sparepart-stock-${periodLabel}.xlsx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const inventory = await getMektekCatalogInventoryExportData(month, request);
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
