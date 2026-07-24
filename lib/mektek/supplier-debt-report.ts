import * as XLSX from "xlsx";

export type SupplierDebtStatus = "BELUM_BAYAR" | "CICILAN" | "LUNAS";

export type SupplierDebtOverviewRow = {
  sourceRow: number;
  number: string;
  supplierName: string;
  pic: string | null;
  location: string | null;
  remainingDebt: number;
  remainingReceivable: number;
  paymentTermDays: number | null;
  dueAmount: number;
  dueDescription: string | null;
  breakdown: number[];
  breakdownNote: string | null;
};

export type SupplierDebtRecapEntry = {
  sourceRow: number;
  number: string;
  supplierName: string;
  invoiceDate: string | null;
  invoiceNumber: string;
  nominal: number;
  actualPaymentDate: string | null;
  totalPayment: number;
  monthNumber: number | null;
  transactionType: string | null;
  accountCategory: string | null;
  otherDebtCategory: string | null;
  accountantServiceDebt: string | null;
  cashCategory: string | null;
};

export type SupplierDebtMonthlySummary = {
  period: string;
  debtValue: number;
  paidValue: number;
  remainingDebt: number;
};

export type SupplierDebtDetailEntry = {
  sourceRow: number;
  number: string | null;
  purchaseOrderDate: string | null;
  purchaseOrderNumber: string | null;
  goodsReceiptDate: string | null;
  receivedBy: string | null;
  deliveryNoteNumber: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  taxInvoiceNumber: string | null;
  dueDate: string | null;
  partNumber: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  grandTotal: number;
  partsEntryDate: string | null;
  paymentDate: string | null;
  paymentAmount: number;
  pbkDate: string | null;
  accountCode: string | null;
  status: SupplierDebtStatus;
  remainingAmount: number;
};

export type SupplierDebtDetailSheet = {
  sheetKey: string;
  position: number;
  supplierName: string;
  contactName: string | null;
  paymentTermDays: number | null;
  phone: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  entries: SupplierDebtDetailEntry[];
};

export type SupplierDebtWorkbookReport = {
  overview: {
    title: string;
    period: string | null;
    updatedAt: string | null;
    rows: SupplierDebtOverviewRow[];
  };
  recap: {
    title: string;
    entries: SupplierDebtRecapEntry[];
    monthlySummary: SupplierDebtMonthlySummary[];
  };
  detailSheets: SupplierDebtDetailSheet[];
};

type SheetRow = unknown[];

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized && normalized !== "-" && normalized !== "Rp-" ? normalized : null;
};

const number = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = text(value);
  if (!normalized) return 0;
  const currencyValue = normalized.replace(/Rp/gi, "").trim();
  if (!/^\(?[-+]?\d[\d,.\s]*\)?$/.test(currencyValue)) return 0;
  const negative = /^\(.*\)$/.test(currencyValue);
  const parsed = Number(
    currencyValue
      .replace(/[()]/g, "")
      .replace(/[^0-9.-]/g, ""),
  );
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const nullableNumber = (value: unknown): number | null => {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const date = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20_000 && value < 80_000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const rowsFor = (sheet: XLSX.WorkSheet): SheetRow[] => {
  const usedRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  usedRange.s = { r: 0, c: 0 };
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: XLSX.utils.encode_range(usedRange),
  });
};

const rowIncludes = (row: SheetRow, expected: string) =>
  row.some((cell) => text(cell)?.toUpperCase() === expected.toUpperCase());

const findHeader = (rows: SheetRow[], required: string[]) =>
  rows.findIndex((row) => required.every((label) => rowIncludes(row, label)));

export const supplierDebtStatus = (
  grandTotal: number,
  paidAmount: number,
): SupplierDebtStatus => {
  if (grandTotal > 0 && paidAmount >= grandTotal) return "LUNAS";
  if (paidAmount > 0) return "CICILAN";
  return "BELUM_BAYAR";
};

const extractOverview = (
  sheet: XLSX.WorkSheet,
): SupplierDebtWorkbookReport["overview"] => {
  const rows = rowsFor(sheet);
  const headerIndex = findHeader(rows, ["NAMA", "SISA HUTANG"]);
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const breakdownStart = Math.max(
    10,
    header.findIndex((cell) => text(cell)?.toUpperCase() === "RINCIAN"),
  );
  const reportRows = rows
    .slice(headerIndex + 1)
    .map((row, offset): SupplierDebtOverviewRow | null => {
      const supplierName = text(row[1]);
      const rowNumber = text(row[0]);
      if (
        !supplierName ||
        !rowNumber ||
        supplierName.toUpperCase().includes("TOTAL HUTANG")
      ) {
        return null;
      }
      const breakdownValues = row
        .slice(breakdownStart)
        .map(number)
        .filter((value) => value !== 0);
      const trailingText = row
        .slice(breakdownStart)
        .map(text)
        .filter((value): value is string => Boolean(value))
        .filter((value) => number(value) === 0)
        .join(" · ");
      return {
        sourceRow: headerIndex + offset + 2,
        number: rowNumber,
        supplierName,
        pic: text(row[2]),
        location: text(row[3]),
        remainingDebt: number(row[4]),
        remainingReceivable: number(row[5]),
        paymentTermDays: nullableNumber(row[6]),
        dueAmount: number(row[7]),
        dueDescription: text(row[8]),
        breakdown: breakdownValues,
        breakdownNote: trailingText || null,
      };
    })
    .filter((row): row is SupplierDebtOverviewRow => Boolean(row));

  return {
    title:
      rows
        .flat()
        .map(text)
        .find((value) => value?.toUpperCase().startsWith("REKAP HUTANG")) ??
      "Total Hutang Semua Pemasok",
    period:
      rows
        .flat()
        .map(text)
        .find((value) => value?.toUpperCase().includes("JANUARI S/D DESEMBER")) ??
      null,
    updatedAt:
      rows
        .flat()
        .map(text)
        .find((value) => value?.toUpperCase().startsWith("UPDATE")) ??
      null,
    rows: reportRows,
  };
};

const extractRecap = (
  sheet: XLSX.WorkSheet,
): SupplierDebtWorkbookReport["recap"] => {
  const rows = rowsFor(sheet);
  const headerIndex = findHeader(rows, ["NAMA SUPPLIER", "NOMOR NOTA / INVOICE"]);
  const entries = rows
    .slice(headerIndex + 1)
    .map((row, offset): SupplierDebtRecapEntry | null => {
      const supplierName = text(row[1]);
      const invoiceNumber = text(row[3]);
      if (!supplierName || !invoiceNumber || number(row[4]) === 0) return null;
      return {
        sourceRow: headerIndex + offset + 2,
        number: text(row[0]) ?? String(offset + 1),
        supplierName,
        invoiceDate: date(row[2]),
        invoiceNumber,
        nominal: number(row[4]),
        actualPaymentDate: date(row[5]),
        totalPayment: number(row[6]),
        monthNumber: nullableNumber(row[8]),
        transactionType: text(row[9]),
        accountCategory: text(row[10]),
        otherDebtCategory: text(row[11]),
        accountantServiceDebt: text(row[12]),
        cashCategory: text(row[13]),
      };
    })
    .filter((row): row is SupplierDebtRecapEntry => Boolean(row));

  const monthlySummary = rows
    .slice(headerIndex + 1, headerIndex + 15)
    .map((row): SupplierDebtMonthlySummary | null => {
      const period = text(row[15]);
      if (!period) return null;
      return {
        period,
        debtValue: number(row[16]),
        paidValue: number(row[17]),
        remainingDebt: number(row[18]),
      };
    })
    .filter((row): row is SupplierDebtMonthlySummary => Boolean(row));

  return {
    title: "Rekap Hutang Pemasok",
    entries,
    monthlySummary,
  };
};

const metadataValue = (rows: SheetRow[], prefix: string) => {
  const match = rows
    .slice(0, 16)
    .flat()
    .map(text)
    .find((value) => value?.toUpperCase().startsWith(prefix.toUpperCase()));
  return match?.slice(match.indexOf(":") + 1).trim() || null;
};

const extractDetailSheet = (
  sheetKey: string,
  sheet: XLSX.WorkSheet,
  position: number,
): SupplierDebtDetailSheet => {
  const rows = rowsFor(sheet);
  const headerIndex = findHeader(rows, ["TANGGAL PO", "GRAND TOTAL"]);
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : [];
  const hasTaxInvoiceColumn = headerRow.some((cell) =>
    /^(NOMOR|NO\.?)\s*FP$/i.test(text(cell) ?? ""),
  );
  const detailColumnOffset = hasTaxInvoiceColumn ? 0 : -1;
  const title = metadataValue(rows, "REKAP HUTANG");
  const contactLine = metadataValue(rows, "PIC");
  const topMatch = contactLine?.match(/\bTOP\s*:\s*N?\s*(\d+)/i);
  const contactName =
    contactLine?.replace(/,\s*TOP\s*:.*$/i, "").trim() || null;
  const entries =
    headerIndex < 0
      ? []
      : rows
          .slice(headerIndex + 1)
          .map((row, offset): SupplierDebtDetailEntry | null => {
            const purchaseOrderNumber = text(row[2]);
            const deliveryNoteNumber = text(row[5]);
            const invoiceNumber = text(row[7]);
            const description = text(row[12 + detailColumnOffset]);
            const grandTotal = number(row[16 + detailColumnOffset]);
            const paymentAmount = number(row[19 + detailColumnOffset]);
            const helperNumberingRow =
              text(row[1]) === "2" &&
              text(row[2]) === "3" &&
              number(row[13]) <= 20;
            if (
              helperNumberingRow ||
              (!purchaseOrderNumber &&
                !deliveryNoteNumber &&
                !invoiceNumber &&
                !description &&
                grandTotal === 0 &&
                paymentAmount === 0)
            ) {
              return null;
            }
            return {
              sourceRow: headerIndex + offset + 2,
              number: text(row[0]),
              purchaseOrderDate: date(row[1]),
              purchaseOrderNumber,
              goodsReceiptDate: date(row[3]),
              receivedBy: text(row[4]),
              deliveryNoteNumber,
              invoiceDate: date(row[6]),
              invoiceNumber,
              taxInvoiceNumber: hasTaxInvoiceColumn ? text(row[8]) : null,
              dueDate: date(row[9 + detailColumnOffset]),
              partNumber: text(row[11 + detailColumnOffset]),
              description,
              quantity: number(row[13 + detailColumnOffset]),
              unitPrice: number(row[14 + detailColumnOffset]),
              amount: number(row[15 + detailColumnOffset]),
              grandTotal,
              partsEntryDate: date(row[17 + detailColumnOffset]),
              paymentDate: date(row[18 + detailColumnOffset]),
              paymentAmount,
              pbkDate: date(row[20 + detailColumnOffset]),
              accountCode: text(row[21 + detailColumnOffset]),
              status: supplierDebtStatus(grandTotal, paymentAmount),
              remainingAmount: Math.max(grandTotal - paymentAmount, 0),
            };
          })
          .filter((row): row is SupplierDebtDetailEntry => Boolean(row));

  return {
    sheetKey,
    position,
    supplierName: title || sheetKey,
    contactName,
    paymentTermDays: topMatch ? Number(topMatch[1]) : null,
    phone: metadataValue(rows, "HP"),
    bankAccount: metadataValue(rows, "NO REK"),
    bankAccountName: metadataValue(rows, "AN"),
    bankName: metadataValue(rows, "BANK"),
    entries,
  };
};

export const extractSupplierDebtWorkbook = (
  workbook: XLSX.WorkBook,
): SupplierDebtWorkbookReport => {
  const [overviewName, recapName] = workbook.SheetNames;
  if (!overviewName || !recapName) {
    throw new Error("Workbook laporan hutang harus memiliki minimal dua sheet.");
  }

  return {
    overview: extractOverview(workbook.Sheets[overviewName]),
    recap: extractRecap(workbook.Sheets[recapName]),
    detailSheets: workbook.SheetNames.slice(2).map((sheetKey, index) =>
      extractDetailSheet(sheetKey, workbook.Sheets[sheetKey], index + 1),
    ),
  };
};
