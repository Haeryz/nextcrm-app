import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import type {
  SupplierDebtDetailEntry,
  SupplierDebtOverviewRow,
  SupplierDebtRecapEntry,
  SupplierDebtStatus,
  SupplierDebtWorkbookReport,
} from "@/lib/mektek/supplier-debt-report";

import SupplierDebtReportManager from "../_components/SupplierDebtReportManager";

const PAGE_SIZE = 50;
const report = snapshot.report as SupplierDebtWorkbookReport;

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

  const overviewSummary = {
    total: report.overview.rows.reduce(
      (total, row) => total + row.remainingDebt,
      0,
    ),
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
    total: report.recap.entries.reduce((total, row) => total + row.nominal, 0),
    paid: report.recap.entries.reduce(
      (total, row) => total + row.totalPayment,
      0,
    ),
    remaining: report.recap.entries.reduce(
      (total, row) => total + Math.max(row.nominal - row.totalPayment, 0),
      0,
    ),
    count: report.recap.entries.length,
  };
  const detailSummary = {
    total:
      selectedSheet?.entries.reduce(
        (total, row) => total + row.grandTotal,
        0,
      ) ?? 0,
    paid:
      selectedSheet?.entries.reduce(
        (total, row) => total + row.paymentAmount,
        0,
      ) ?? 0,
    remaining:
      selectedSheet?.entries.reduce(
        (total, row) => total + row.remainingAmount,
        0,
      ) ?? 0,
    count: selectedSheet?.entries.length ?? 0,
    LUNAS:
      selectedSheet?.entries.filter(
        (row) => row.grandTotal > 0 && row.status === "LUNAS",
      ).length ?? 0,
    CICILAN:
      selectedSheet?.entries.filter(
        (row) => row.grandTotal > 0 && row.status === "CICILAN",
      ).length ?? 0,
    BELUM_BAYAR:
      selectedSheet?.entries.filter(
        (row) => row.grandTotal > 0 && row.status === "BELUM_BAYAR",
      ).length ?? 0,
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
  const recapRows = report.recap.entries
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
  const detailRows = (selectedSheet?.entries ?? [])
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
  for (const row of selectedSheet?.entries ?? []) {
    if (!row.invoiceDate || !row.grandTotal) continue;
    const month = Number(row.invoiceDate.slice(5, 7));
    if (month >= 1 && month <= 12) {
      monthlyTotals[month - 1] += row.grandTotal;
    }
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
      recapMonthlySummary={report.recap.monthlySummary}
      sheets={report.detailSheets.map((sheet) => ({
        sheetKey: sheet.sheetKey,
        supplierName: sheet.supplierName,
        contactName: sheet.contactName,
        paymentTermDays: sheet.paymentTermDays,
        phone: sheet.phone,
        bankAccount: sheet.bankAccount,
        bankAccountName: sheet.bankAccountName,
        bankName: sheet.bankName,
        entryCount: sheet.entries.length,
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
