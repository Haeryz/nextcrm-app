import * as XLSX from "xlsx-js-style";

import {
  buildLogisticsDeliveryNoteExportRows,
  buildLogisticsPoMonthlyExportRows,
  getLogisticsPoExportRange,
  LOGISTICS_DELIVERY_NOTE_EXPORT_HEADERS,
  LOGISTICS_PO_MONTHLY_EXPORT_HEADERS,
  parseLogisticsPoExportType,
} from "@/lib/mektek/logistics-export";
import { requireMektekLogisticsApiSession } from "@/lib/mektek/logistics-api";
import { prismadb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ExportCell = string | number;
type ExportRow = Record<string, ExportCell>;

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
  fill: { patternType: "solid", fgColor: { rgb: "FCE4D6" } },
  font: { color: { rgb: "9C5700" } },
} as const;

function buildWorksheet(
  title: string,
  headers: readonly string[],
  rows: ExportRow[],
  widths: number[],
) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [title],
    [...headers],
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);
  const lastColumn = headers.length - 1;
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
  ];
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!rows"] = [{ hpt: 28 }, { hpt: 32 }];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 1, c: 0 },
      e: { r: Math.max(rows.length + 1, 1), c: lastColumn },
    }),
  };

  const titleCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  if (titleCell) titleCell.s = titleStyle;
  headers.forEach((_, columnIndex) => {
    const cell = worksheet[
      XLSX.utils.encode_cell({ r: 1, c: columnIndex })
    ];
    if (cell) cell.s = headerStyle;
  });

  let currentStatus = "";
  rows.forEach((row, rowIndex) => {
    if (row.Status) currentStatus = String(row.Status);
    if (currentStatus !== "Open") return;
    headers.forEach((_, columnIndex) => {
      const cell = worksheet[
        XLSX.utils.encode_cell({ r: rowIndex + 2, c: columnIndex })
      ];
      if (cell) cell.s = openRowStyle;
    });
  });

  return worksheet;
}

export async function GET(request: Request) {
  const access = await requireMektekLogisticsApiSession("MONITORING_PO", request);
  if (access.response) return access.response;
  const searchParams = new URL(request.url).searchParams;
  const month = searchParams.get("month") ?? "";

  try {
    const exportType = parseLogisticsPoExportType(
      searchParams.get("type") ?? "delivery-note",
    );
    const range = getLogisticsPoExportRange(month, month);
    const orders = await prismadb.logisticsPurchaseOrder.findMany({
      where:
        exportType === "delivery-note"
          ? {
              flow: "OUTBOUND",
              items: {
                some: {
                  receipts: {
                    some: {
                      receivedAt: { gte: range.start, lt: range.end },
                    },
                  },
                },
              },
            }
          : {
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
        dueDate: true,
        deliveryDate: true,
        poType: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            partName: true,
            partNumber: true,
            orderedQuantity: true,
            receivedQuantity: true,
            receipts: {
              orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
              select: {
                receivingReference: true,
                quantity: true,
                receivedAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const isDeliveryNote = exportType === "delivery-note";
    const headers = isDeliveryNote
      ? LOGISTICS_DELIVERY_NOTE_EXPORT_HEADERS
      : LOGISTICS_PO_MONTHLY_EXPORT_HEADERS;
    const rows = (isDeliveryNote
      ? buildLogisticsDeliveryNoteExportRows(orders, range)
      : buildLogisticsPoMonthlyExportRows(orders)) as ExportRow[];
    const worksheet = buildWorksheet(
      isDeliveryNote ? "SJ Bulanan" : "Recap PO Bulanan",
      headers,
      rows,
      isDeliveryNote
        ? [18, 18, 18, 12, 20, 24, 30, 26, 28, 22, 16, 12, 12, 12]
        : [8, 30, 20, 24, 26, 28, 22, 16, 12, 12, 12, 12],
    );

    const summaryRows = [
      { Ringkasan: "Periode", Nilai: range.fromMonth },
      {
        Ringkasan: "Jenis recap",
        Nilai: isDeliveryNote ? "SJ Bulanan" : "Recap PO Bulanan",
      },
      {
        Ringkasan: isDeliveryNote ? "Jumlah SJ" : "Jumlah PO",
        Nilai: isDeliveryNote
          ? rows.filter((row) => row["No SJ"]).length
          : orders.length,
      },
      { Ringkasan: "Jumlah baris item", Nilai: rows.length },
      {
        Ringkasan: "Total QTY Keluar",
        Nilai: rows.reduce(
          (sum, row) => sum + Number(row["QTY Keluar"] || 0),
          0,
        ),
      },
      ...(!isDeliveryNote
        ? [
            {
              Ringkasan: "Total QTY Order",
              Nilai: rows.reduce(
                (sum, row) => sum + Number(row["QTY Order"] || 0),
                0,
              ),
            },
            {
              Ringkasan: "Total QTY Sisa",
              Nilai: rows.reduce(
                (sum, row) => sum + Number(row["QTY Sisa"] || 0),
                0,
              ),
            },
          ]
        : []),
    ];
    const summary = XLSX.utils.json_to_sheet(summaryRows);
    summary["!cols"] = [{ wch: 24 }, { wch: 28 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      isDeliveryNote ? "SJ Bulanan" : "Recap PO Bulanan",
    );
    XLSX.utils.book_append_sheet(workbook, summary, "Ringkasan");
    const file = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    });
    const suffix = isDeliveryNote ? "sj" : "po";

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mektek-monitoring-po-${suffix}-${range.fromMonth}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const isValidationError =
      error instanceof Error &&
      /^(Bulan|Rentang export|Jenis recap)/.test(error.message);
    if (!isValidationError) {
      console.log("[EXPORT_MEKTEK_OUTBOUND_PO]", error);
    }
    return Response.json(
      {
        error: isValidationError
          ? error.message
          : "Gagal export Monitoring PO",
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
