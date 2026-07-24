import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import type {
  SupplierDebtDetailEntry,
  SupplierDebtOverviewRow,
  SupplierDebtRecapEntry,
  SupplierDebtStatus,
  SupplierDebtWorkbookReport,
} from "@/lib/mektek/supplier-debt-report";
import { supplierDebtStatus } from "@/lib/mektek/supplier-debt-report";
import { prismadb } from "@/lib/prisma";

import SupplierDebtReportManager from "../_components/SupplierDebtReportManager";

const PAGE_SIZE = 50;
const report = snapshot.report as SupplierDebtWorkbookReport;
const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

const normalizeView = (value: string | undefined) =>
  value === "recap" || value === "detail" ? value : "overview";

const normalizeStatus = (
  value: string | undefined,
): "SEMUA" | SupplierDebtStatus =>
  value === "BELUM_BAYAR" || value === "CICILAN" || value === "LUNAS"
    ? value
    : "SEMUA";

const normalizeDirection = (value: string | undefined): "asc" | "desc" =>
  value === "desc" ? "desc" : "asc";

const searchable = (values: unknown[], search: string) =>
  values.some((value) =>
    String(value ?? "")
      .toLocaleLowerCase("id-ID")
      .includes(search),
  );

const compareValues = (left: unknown, right: unknown) => {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left ?? "").localeCompare(String(right ?? ""), "id-ID", {
    numeric: true,
    sensitivity: "base",
  });
};

const overviewSortValue = (row: SupplierDebtOverviewRow, sort: string) => {
  if (sort === "supplierName") return row.supplierName;
  if (sort === "remainingDebt") return row.remainingDebt;
  if (sort === "dueAmount") return row.dueAmount;
  return row.sourceRow;
};

const recapSortValue = (row: SupplierDebtRecapEntry, sort: string) => {
  if (sort === "supplierName") return row.supplierName;
  if (sort === "invoiceDate") return row.invoiceDate;
  if (sort === "invoiceNumber") return row.invoiceNumber;
  if (sort === "grandTotal") return row.nominal;
  if (sort === "paymentAmount") return row.totalPayment;
  if (sort === "remainingAmount") return Math.max(row.nominal - row.totalPayment, 0);
  return row.sourceRow;
};

const detailSortValue = (row: SupplierDebtDetailEntry, sort: string) => {
  if (sort === "supplierName") return row.description;
  if (sort === "invoiceDate") return row.invoiceDate;
  if (sort === "invoiceNumber") return row.invoiceNumber;
  if (sort === "grandTotal") return row.grandTotal;
  if (sort === "paymentAmount") return row.paymentAmount;
  if (sort === "remainingAmount") return row.remainingAmount;
  return row.sourceRow;
};

export default async function SupplierDebtReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    sheet?: string;
    q?: string;
    status?: string;
    sort?: string;
    direction?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const view = normalizeView(query.view);
  const status = normalizeStatus(query.status);
  const direction = normalizeDirection(query.direction);
  const sort = String(query.sort ?? "number");
  const search = String(query.q ?? "").trim().slice(0, 100);
  const normalizedSearch = search.toLocaleLowerCase("id-ID");
  const selectedSheet =
    report.detailSheets.find((sheet) => sheet.sheetKey === query.sheet) ??
    report.detailSheets[0] ??
    null;
  const persistedEntries = await prismadb.mektekSupplierDebtEntry.findMany({
    orderBy: [{ sheetKey: "asc" }, { sourceRow: "asc" }],
  });
  const manualEntries = persistedEntries.map((row) => {
    const grandTotal = Number(row.grandTotal);
    const paymentAmount = Number(row.paymentAmount);
    return {
      sheetKey: row.sheetKey,
      entry: {
        id: row.id,
        isManual: true,
        sourceRow: row.sourceRow,
        number: row.number,
        purchaseOrderDate: dateOnly(row.purchaseOrderDate),
        purchaseOrderNumber: row.purchaseOrderNumber,
        goodsReceiptDate: dateOnly(row.goodsReceiptDate),
        receivedBy: row.receivedBy,
        deliveryNoteNumber: row.deliveryNoteNumber,
        invoiceDate: dateOnly(row.invoiceDate),
        invoiceNumber: row.invoiceNumber,
        taxInvoiceNumber: row.taxInvoiceNumber,
        dueDate: dateOnly(row.dueDate),
        partNumber: row.partNumber,
        description: row.description,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        amount: Number(row.amount),
        grandTotal,
        partsEntryDate: dateOnly(row.partsEntryDate),
        paymentDate: dateOnly(row.paymentDate),
        paymentAmount,
        pbkDate: dateOnly(row.pbkDate),
        accountCode: row.accountCode,
        status: supplierDebtStatus(grandTotal, paymentAmount),
        remainingAmount: Math.max(grandTotal - paymentAmount, 0),
      } satisfies SupplierDebtDetailEntry,
    };
  });
  const selectedManualEntries = manualEntries
    .filter((row) => row.sheetKey === selectedSheet?.sheetKey)
    .map((row) => row.entry);
  const selectedEntries = [
    ...(selectedSheet?.entries ?? []),
    ...selectedManualEntries,
  ];
  const manualRecapEntries: SupplierDebtRecapEntry[] = manualEntries.map(
    ({ sheetKey, entry }, index) => {
      const sheet = report.detailSheets.find((candidate) => candidate.sheetKey === sheetKey);
      return {
        sourceRow: 2_000_000 + index,
        number: entry.number ?? String(index + 1),
        supplierName: sheet?.supplierName ?? sheetKey,
        invoiceDate: entry.invoiceDate,
        invoiceNumber:
          entry.invoiceNumber ??
          entry.purchaseOrderNumber ??
          entry.deliveryNoteNumber ??
          "Baris manual",
        nominal: entry.grandTotal,
        actualPaymentDate: entry.paymentDate,
        totalPayment: entry.paymentAmount,
        monthNumber: entry.invoiceDate ? Number(entry.invoiceDate.slice(5, 7)) : null,
        transactionType: "Hutang usaha",
        accountCategory: entry.accountCode,
        otherDebtCategory: null,
        accountantServiceDebt: null,
        cashCategory: null,
      };
    },
  );
  const combinedRecapEntries = [...report.recap.entries, ...manualRecapEntries];
  const manualRemaining = manualEntries.reduce(
    (total, row) => total + row.entry.remainingAmount,
    0,
  );

  const overviewSummary = {
    total: report.overview.rows.reduce(
      (total, row) => total + row.remainingDebt,
      0,
    ) + manualRemaining,
    paid: report.overview.rows.reduce(
      (total, row) => total + row.remainingReceivable,
      0,
    ),
    remaining: report.overview.rows.reduce(
      (total, row) => total + row.dueAmount,
      0,
    ),
    count: report.overview.rows.length,
  };
  const recapSummary = {
    total: combinedRecapEntries.reduce((total, row) => total + row.nominal, 0),
    paid: combinedRecapEntries.reduce(
      (total, row) => total + row.totalPayment,
      0,
    ),
    remaining: combinedRecapEntries.reduce(
      (total, row) => total + Math.max(row.nominal - row.totalPayment, 0),
      0,
    ),
    count: combinedRecapEntries.length,
  };
  const detailSummary = {
    total:
      selectedEntries.reduce(
        (total, row) => total + row.grandTotal,
        0,
      ),
    paid:
      selectedEntries.reduce(
        (total, row) => total + row.paymentAmount,
        0,
      ),
    remaining:
      selectedEntries.reduce(
        (total, row) => total + row.remainingAmount,
        0,
      ),
    count: selectedEntries.length,
    LUNAS:
      selectedEntries.filter(
        (row) => row.grandTotal > 0 && row.status === "LUNAS",
      ).length,
    CICILAN:
      selectedEntries.filter(
        (row) => row.grandTotal > 0 && row.status === "CICILAN",
      ).length,
    BELUM_BAYAR:
      selectedEntries.filter(
        (row) => row.grandTotal > 0 && row.status === "BELUM_BAYAR",
      ).length,
  };

  const overviewRows = report.overview.rows
    .filter(
      (row) =>
        !normalizedSearch ||
        searchable(
          [
            row.supplierName,
            row.pic,
            row.location,
            row.dueDescription,
            row.breakdownNote,
          ],
          normalizedSearch,
        ),
    )
    .sort(
      (left, right) =>
        compareValues(
          overviewSortValue(left, sort),
          overviewSortValue(right, sort),
        ) * (direction === "asc" ? 1 : -1),
    );
  const recapRows = combinedRecapEntries
    .filter(
      (row) =>
        !normalizedSearch ||
        searchable(
          [
            row.supplierName,
            row.invoiceNumber,
            row.transactionType,
            row.accountCategory,
          ],
          normalizedSearch,
        ),
    )
    .sort(
      (left, right) =>
        compareValues(recapSortValue(left, sort), recapSortValue(right, sort)) *
        (direction === "asc" ? 1 : -1),
    );
  const detailRows = selectedEntries
    .filter(
      (row) =>
        (status === "SEMUA" ||
          (row.grandTotal > 0 && row.status === status)) &&
        (!normalizedSearch ||
          searchable(
            [
              row.purchaseOrderNumber,
              row.deliveryNoteNumber,
              row.invoiceNumber,
              row.taxInvoiceNumber,
              row.partNumber,
              row.description,
              row.accountCode,
            ],
            normalizedSearch,
          )),
    )
    .sort(
      (left, right) =>
        compareValues(
          detailSortValue(left, sort),
          detailSortValue(right, sort),
        ) * (direction === "asc" ? 1 : -1),
    );

  const activeRows =
    view === "overview"
      ? overviewRows
      : view === "recap"
        ? recapRows
        : detailRows;
  const requestedPage = Math.max(
    1,
    Number.parseInt(query.page ?? "1", 10) || 1,
  );
  const pageCount = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const monthlyTotals = Array.from({ length: 12 }, () => 0);
  for (const row of selectedEntries) {
    if (!row.invoiceDate || !row.grandTotal) continue;
    const month = Number(row.invoiceDate.slice(5, 7));
    if (month >= 1 && month <= 12) {
      monthlyTotals[month - 1] += row.grandTotal;
    }
  }
  const recapMonthlySummary = report.recap.monthlySummary.map((row) => ({ ...row }));
  for (const row of manualEntries) {
    const month = row.entry.invoiceDate
      ? Number(row.entry.invoiceDate.slice(5, 7))
      : 0;
    const target = recapMonthlySummary[month - 1];
    if (!target) continue;
    target.debtValue += row.entry.grandTotal;
    target.paidValue += row.entry.paymentAmount;
    target.remainingDebt += row.entry.remainingAmount;
  }

  return (
    <SupplierDebtReportManager
      sourceFile={snapshot.sourceFile}
      view={view}
      overviewMeta={{
        title: report.overview.title,
        period: report.overview.period,
        updatedAt: report.overview.updatedAt,
      }}
      overviewRows={
        view === "overview" ? overviewRows.slice(start, start + PAGE_SIZE) : []
      }
      overviewSummary={overviewSummary}
      recapRows={
        view === "recap" ? recapRows.slice(start, start + PAGE_SIZE) : []
      }
      recapSummary={recapSummary}
      recapMonthlySummary={recapMonthlySummary}
      sheets={report.detailSheets.map((sheet) => ({
        sheetKey: sheet.sheetKey,
        supplierName: sheet.supplierName,
        contactName: sheet.contactName,
        paymentTermDays: sheet.paymentTermDays,
        phone: sheet.phone,
        bankAccount: sheet.bankAccount,
        bankAccountName: sheet.bankAccountName,
        bankName: sheet.bankName,
        entryCount:
          sheet.entries.length +
          manualEntries.filter((row) => row.sheetKey === sheet.sheetKey).length,
      }))}
      selectedSheetKey={selectedSheet?.sheetKey ?? null}
      detailRows={
        view === "detail" ? detailRows.slice(start, start + PAGE_SIZE) : []
      }
      detailSummary={detailSummary}
      monthlyTotals={monthlyTotals}
      search={search}
      status={status}
      sort={sort}
      direction={direction}
      page={page}
      pageCount={pageCount}
      totalRows={activeRows.length}
    />
  );
}
