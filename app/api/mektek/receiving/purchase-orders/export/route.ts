import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx-js-style";

import { getCatalogInventoryLocalDateKey } from "@/lib/mektek/catalog-inventory";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import {
  buildReceivingPurchaseOrderExportRows,
  RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS,
} from "@/lib/mektek/receiving-export";
import { prismadb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const titleStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "1F4E78" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
  alignment: { horizontal: "center", vertical: "center" },
} as const;

const headerStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "D9EAF7" } },
  font: { bold: true, color: { rgb: "17365D" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "9EADBA" } },
    bottom: { style: "thin", color: { rgb: "9EADBA" } },
    left: { style: "thin", color: { rgb: "9EADBA" } },
    right: { style: "thin", color: { rgb: "9EADBA" } },
  },
} as const;

const openRowStyle = {
  fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
  font: { color: { rgb: "7F6000" } },
} as const;

function buildWhere(searchParams: URLSearchParams) {
  const query = (searchParams.get("q") ?? "").trim().slice(0, 160);
  const rawStatus = (searchParams.get("status") ?? "").trim().toUpperCase();
  const status = rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : null;
  const where: Prisma.LogisticsPurchaseOrderWhereInput = {
    flow: "RECEIVING",
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { poNumber: { contains: query, mode: "insensitive" as const } },
            { supplierName: { contains: query, mode: "insensitive" as const } },
            { userName: { contains: query, mode: "insensitive" as const } },
            { projectName: { contains: query, mode: "insensitive" as const } },
            { poType: { contains: query, mode: "insensitive" as const } },
            {
              items: {
                some: {
                  OR: [
                    { partName: { contains: query, mode: "insensitive" as const } },
                    { partNumber: { contains: query, mode: "insensitive" as const } },
                    {
                      receipts: {
                        some: {
                          receivingReference: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  return { where, query, status };
}

export async function GET(request: Request) {
  const access = await requireMektekLogisticsApiSession("RECEIVING");
  if (access.response) return access.response;

  try {
    const { where, query, status } = buildWhere(new URL(request.url).searchParams);
    const orders = await prismadb.logisticsPurchaseOrder.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
      select: {
        projectName: true,
        inputDate: true,
        dueDate: true,
        poNumber: true,
        poType: true,
        supplierName: true,
        status: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            partName: true,
            orderedQuantity: true,
            receivedQuantity: true,
          },
        },
      },
    });
    const rows = buildReceivingPurchaseOrderExportRows(orders);
    const headers = RECEIVING_PURCHASE_ORDER_EXPORT_HEADERS;
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Spreadsheet PO Receiving"],
      [...headers],
      ...rows.map((row) => headers.map((header) => row[header])),
    ]);
    const lastColumn = headers.length - 1;
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } }];
    worksheet["!cols"] = [
      8, 28, 18, 18, 22, 16, 26, 44, 14, 14, 14, 14,
    ].map((wch) => ({ wch }));
    worksheet["!rows"] = [{ hpt: 28 }, { hpt: 32 }];
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 1, c: 0 },
        e: { r: Math.max(rows.length + 1, 1), c: lastColumn },
      }),
    };

    const titleCell = worksheet.A1;
    if (titleCell) titleCell.s = titleStyle;
    headers.forEach((_, columnIndex) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 1, c: columnIndex })];
      if (cell) cell.s = headerStyle;
    });
    rows.forEach((row, rowIndex) => {
      if (row.Status !== "Open") return;
      headers.forEach((_, columnIndex) => {
        const cell =
          worksheet[XLSX.utils.encode_cell({ r: rowIndex + 2, c: columnIndex })];
        if (cell) cell.s = openRowStyle;
      });
    });

    const totalReceived = rows.reduce(
      (total, row) => total + Number(row["QTY Masuk"]),
      0,
    );
    const totalOrdered = rows.reduce(
      (total, row) => total + Number(row["QTY Order"]),
      0,
    );
    const summary = XLSX.utils.json_to_sheet([
      { Ringkasan: "Filter pencarian", Nilai: query || "Semua" },
      { Ringkasan: "Filter status", Nilai: status || "Semua" },
      { Ringkasan: "Jumlah Purchase Order", Nilai: orders.length },
      { Ringkasan: "Total QTY Masuk", Nilai: totalReceived },
      { Ringkasan: "Total QTY Order", Nilai: totalOrdered },
      { Ringkasan: "Total QTY Sisa", Nilai: Math.max(0, totalOrdered - totalReceived) },
    ]);
    summary["!cols"] = [{ wch: 24 }, { wch: 28 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receiving");
    XLSX.utils.book_append_sheet(workbook, summary, "Ringkasan");
    const file = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    });
    const dateKey = getCatalogInventoryLocalDateKey();

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mektek-receiving-po-${dateKey}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.log("[EXPORT_MEKTEK_RECEIVING_PO]", error);
    return Response.json(
      { error: "Gagal export Spreadsheet PO Receiving" },
      { status: 500 },
    );
  }
}
