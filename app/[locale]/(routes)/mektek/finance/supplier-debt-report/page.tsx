import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import {
  applySupplierDebtPayments,
  supplierDebtDueState,
  supplierDepositBalance,
} from "@/lib/mektek/supplier-debt-ledger";
import type {
  SupplierDebtDetailEntry,
  SupplierDebtDetailSheet,
  SupplierDebtOverviewRow,
  SupplierDebtRecapEntry,
  SupplierDebtStatus,
  SupplierDebtWorkbookReport,
} from "@/lib/mektek/supplier-debt-report";
import { supplierDebtStatus } from "@/lib/mektek/supplier-debt-report";
import { prismadb } from "@/lib/prisma";

import SupplierDebtReportManager from "../_components/SupplierDebtReportManager";
import { requireFinanceSection } from "../_lib/gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const supplierKey = (value: string) =>
  value
    .toLocaleLowerCase("id-ID")
    .replace(/\b(pt|cv|toko)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

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
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
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
  const { locale } = await params;
  await requireFinanceSection(locale, "finance");
  const query = await searchParams;
  const view = normalizeView(query.view);
  const status = normalizeStatus(query.status);
  const direction = normalizeDirection(query.direction);
  const sort = String(query.sort ?? "number");
  const search = String(query.q ?? "").trim().slice(0, 100);
  const normalizedSearch = search.toLocaleLowerCase("id-ID");
  const [persistedEntries, persistedTransactions] = await Promise.all([
    prismadb.mektekSupplierDebtEntry.findMany({
      orderBy: [{ sheetKey: "asc" }, { sourceRow: "asc" }],
      select: {
        id: true,
        sheetKey: true,
        sourceRow: true,
        number: true,
        purchaseOrderDate: true,
        purchaseOrderNumber: true,
        goodsReceiptDate: true,
        receivedBy: true,
        deliveryNoteNumber: true,
        invoiceDate: true,
        invoiceNumber: true,
        taxInvoiceNumber: true,
        dueDate: true,
        partNumber: true,
        description: true,
        quantity: true,
        unitPrice: true,
        amount: true,
        grandTotal: true,
        partsEntryDate: true,
        paymentDate: true,
        paymentAmount: true,
        pbkDate: true,
        accountCode: true,
      },
    }),
    prismadb.mektekSupplierDebtTransaction.findMany({
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        sheetKey: true,
        sourceRow: true,
        kind: true,
        paymentSource: true,
        amount: true,
        transactionDate: true,
        reference: true,
        note: true,
        proofImageUpdatedAt: true,
      },
    }),
  ]);
  const ledgerTransactions = persistedTransactions.map((transaction) => ({
    sheetKey: transaction.sheetKey,
    sourceRow: transaction.sourceRow,
    kind: transaction.kind,
    paymentSource: transaction.paymentSource,
    amount: Number(transaction.amount),
    transactionDate: dateOnly(transaction.transactionDate),
  }));
  const entryInvoiceNumbers = Array.from(
    new Set(
      persistedEntries
        .map((entry) => entry.invoiceNumber)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const matchedBills = entryInvoiceNumbers.length
    ? await prismadb.financeSupplierBill.findMany({
        where: { supplierInvoiceNumber: { in: entryInvoiceNumbers } },
        include: { lines: { orderBy: { position: "asc" } } },
      })
    : [];
  const billLinesByInvoice: Record<
    string,
    Array<{
      description: string;
      partNumber: string | null;
      quantity: number;
      unitCost: number;
      lineTotal: number;
    }>
  > = {};
  for (const bill of matchedBills) {
    billLinesByInvoice[bill.supplierInvoiceNumber] = bill.lines.map((line) => ({
      description: line.description,
      partNumber: line.partNumber,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      lineTotal: Number(line.lineTotal),
    }));
  }
  const persistedRows = persistedEntries.map((row) => {
    const grandTotal = Number(row.grandTotal);
    const paymentAmount = Number(row.paymentAmount);
    return {
      sheetKey: row.sheetKey,
      entry: {
        id: row.id,
        isManual: row.sourceRow >= 1_000_001,
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
        ledgerPayments: [],
      } satisfies SupplierDebtDetailEntry,
    };
  });
  const persistedByKey = new Map(
    persistedRows.map((row) => [
      `${row.sheetKey}:${row.entry.sourceRow}`,
      row.entry,
    ]),
  );
  // Pemasok baru yang dibuat via Pembayaran Pemasok tersimpan sebagai
  // MektekSupplierDebtEntry dengan sheetKey = nama pemasok. Sheet yang tidak
  // ada di snapshot workbook dibuatkan sheet sintetis di sini agar tampil di
  // Laporan Hutang Pemasok (tampilan Total Hutang dan Rincian per Pemasok).
  const snapshotSheetKeys = new Set(
    report.detailSheets.map((sheet) => sheet.sheetKey),
  );
  const dbOnlySheetKeys = Array.from(
    new Set(persistedEntries.map((row) => row.sheetKey)),
  ).filter((key) => !snapshotSheetKeys.has(key));
  const dbOnlySheets: SupplierDebtDetailSheet[] = dbOnlySheetKeys.map(
    (sheetKey, index) => ({
      sheetKey,
      position: report.detailSheets.length + index + 1,
      supplierName: sheetKey,
      contactName: null,
      paymentTermDays: null,
      phone: null,
      bankAccount: null,
      bankAccountName: null,
      bankName: null,
      entries: [],
    }),
  );
  const allDetailSheets = [...report.detailSheets, ...dbOnlySheets];
  const selectedSheet =
    allDetailSheets.find((sheet) => sheet.sheetKey === query.sheet) ??
    allDetailSheets[0] ??
    null;
  const entriesBySheet = new Map(
    allDetailSheets.map((sheet) => {
      const importedRows = sheet.entries.map(
        (entry) =>
          persistedByKey.get(`${sheet.sheetKey}:${entry.sourceRow}`) ?? entry,
      );
      const manualRows = persistedRows
        .filter(
          (row) => row.sheetKey === sheet.sheetKey && row.entry.isManual,
        )
        .map((row) => row.entry);
      return [
        sheet.sheetKey,
        [...importedRows, ...manualRows].map((entry) => ({
          ...entry,
          ...applySupplierDebtPayments(
            entry,
            ledgerTransactions,
            sheet.sheetKey,
            entry.sourceRow,
          ),
        })),
      ] as const;
    }),
  );
  const allEntries = Array.from(entriesBySheet.entries()).flatMap(
    ([sheetKey, entries]) => entries.map((entry) => ({ sheetKey, entry })),
  );
  const manualEntries = allEntries.filter((row) => row.entry.isManual);
  const selectedEntries =
    (selectedSheet && entriesBySheet.get(selectedSheet.sheetKey)) ?? [];
  const manualRecapEntries: SupplierDebtRecapEntry[] = manualEntries.map(
    ({ sheetKey, entry }, index) => {
      const sheet = allDetailSheets.find((candidate) => candidate.sheetKey === sheetKey);
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
  const originalInvoiceTotals = new Map<
    string,
    { grandTotal: number; paymentAmount: number }
  >();
  const currentInvoiceTotals = new Map<
    string,
    { grandTotal: number; paymentAmount: number }
  >();
  const addInvoiceTotal = (
    target: Map<string, { grandTotal: number; paymentAmount: number }>,
    key: string,
    entry: SupplierDebtDetailEntry,
  ) => {
    const current = target.get(key) ?? { grandTotal: 0, paymentAmount: 0 };
    current.grandTotal += entry.grandTotal;
    current.paymentAmount += entry.paymentAmount;
    target.set(key, current);
  };
  for (const sheet of allDetailSheets) {
    for (const originalEntry of sheet.entries) {
      if (!originalEntry.invoiceNumber) continue;
      const key = `${supplierKey(sheet.supplierName)}:${originalEntry.invoiceNumber.toLocaleLowerCase("id-ID")}`;
      addInvoiceTotal(originalInvoiceTotals, key, originalEntry);
      const currentEntry = entriesBySheet
        .get(sheet.sheetKey)
        ?.find((entry) => entry.sourceRow === originalEntry.sourceRow);
      if (currentEntry) addInvoiceTotal(currentInvoiceTotals, key, currentEntry);
    }
  }
  const adjustedImportedRecap = report.recap.entries.map((entry) => {
    const key = `${supplierKey(entry.supplierName)}:${entry.invoiceNumber.toLocaleLowerCase("id-ID")}`;
    const original = originalInvoiceTotals.get(key);
    const current = currentInvoiceTotals.get(key);
    const nominal = Math.max(
      entry.nominal +
        ((current?.grandTotal ?? original?.grandTotal ?? 0) -
          (original?.grandTotal ?? 0)),
      0,
    );
    return {
      ...entry,
      nominal,
      totalPayment: Math.min(
        nominal,
        Math.max(
          entry.totalPayment +
            ((current?.paymentAmount ?? original?.paymentAmount ?? 0) -
              (original?.paymentAmount ?? 0)),
          0,
        ),
      ),
    };
  });
  const combinedRecapEntries = [...adjustedImportedRecap, ...manualRecapEntries];
  const overviewWithLedger = report.overview.rows.map((row) => {
    const rowKey = supplierKey(row.supplierName);
    const sheet = allDetailSheets.find((candidate) => {
      const keys = [
        supplierKey(candidate.sheetKey),
        supplierKey(candidate.supplierName),
      ];
      return keys.some(
        (key) =>
          key.length >= 4 &&
          (key.includes(rowKey) || rowKey.includes(key)),
      );
    });
    if (!sheet) return row;
    const originalRemaining = sheet.entries.reduce(
      (total, entry) => total + entry.remainingAmount,
      0,
    );
    const currentEntries = entriesBySheet.get(sheet.sheetKey) ?? [];
    const currentRemaining = currentEntries.reduce(
      (total, entry) => total + entry.remainingAmount,
      0,
    );
    const remainingDelta = currentRemaining - originalRemaining;
    const pendingDueDates = currentEntries
      .filter((entry) => entry.dueDate && entry.status !== "LUNAS" && entry.remainingAmount > 0)
      .map((entry) => entry.dueDate!)
      .sort();
    return {
      ...row,
      remainingDebt: Math.max(row.remainingDebt + remainingDelta, 0),
      remainingReceivable:
        row.remainingReceivable +
        supplierDepositBalance(ledgerTransactions, sheet.sheetKey),
      dueAmount: Math.max(row.dueAmount + remainingDelta, 0),
      dueDate: pendingDueDates[0] ?? null,
    };
  });

  // Tambahkan pemasok baru (dari Pembayaran Pemasok) sebagai baris overview
  // sintetis agar tampil di tampilan "Total Hutang".
  const dbOnlyOverviewRows: SupplierDebtOverviewRow[] = dbOnlySheets.map(
    (sheet) => {
      const sheetEntries = entriesBySheet.get(sheet.sheetKey) ?? [];
      const remainingDebt = sheetEntries.reduce(
        (sum, entry) => sum + entry.remainingAmount,
        0,
      );
      const pendingDueDates = sheetEntries
        .filter((entry) => entry.dueDate && entry.status !== "LUNAS" && entry.remainingAmount > 0)
        .map((entry) => entry.dueDate!)
        .sort();
      return {
        sourceRow: sheet.position,
        number: String(sheet.position),
        supplierName: sheet.supplierName,
        pic: null,
        location: null,
        remainingDebt,
        remainingReceivable: 0,
        paymentTermDays: null,
        dueAmount: remainingDebt,
        dueDate: pendingDueDates[0] ?? null,
        dueDescription: null,
        breakdown: [],
        breakdownNote: null,
      };
    },
  );
  const overviewRowsWithDbOnly = [...overviewWithLedger, ...dbOnlyOverviewRows];

  const overviewSummary = {
    total: overviewRowsWithDbOnly.reduce(
      (total, row) => total + row.remainingDebt,
      0,
    ),
    paid: overviewRowsWithDbOnly.reduce(
      (total, row) => total + row.remainingReceivable,
      0,
    ),
    remaining: overviewRowsWithDbOnly.reduce(
      (total, row) => total + row.dueAmount,
      0,
    ),
    count: overviewRowsWithDbOnly.length,
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

  const overviewRows = overviewRowsWithDbOnly
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
  const adjustMonthlySummary = (
    month: number,
    entry: Pick<
      SupplierDebtDetailEntry,
      "grandTotal" | "paymentAmount" | "remainingAmount"
    >,
    direction: 1 | -1,
  ) => {
    const target = recapMonthlySummary[month - 1];
    if (!target) return;
    target.debtValue += entry.grandTotal * direction;
    target.paidValue += entry.paymentAmount * direction;
    target.remainingDebt += entry.remainingAmount * direction;
  };
  for (const sheet of allDetailSheets) {
    for (const originalEntry of sheet.entries) {
      const currentEntry = entriesBySheet
        .get(sheet.sheetKey)
        ?.find((entry) => entry.sourceRow === originalEntry.sourceRow);
      if (!currentEntry) continue;
      const originalMonth = originalEntry.invoiceDate
        ? Number(originalEntry.invoiceDate.slice(5, 7))
        : 0;
      const currentMonth = currentEntry.invoiceDate
        ? Number(currentEntry.invoiceDate.slice(5, 7))
        : 0;
      adjustMonthlySummary(originalMonth, originalEntry, -1);
      adjustMonthlySummary(currentMonth, currentEntry, 1);
    }
  }
  for (const row of manualEntries) {
    const month = row.entry.invoiceDate
      ? Number(row.entry.invoiceDate.slice(5, 7))
      : 0;
    adjustMonthlySummary(month, row.entry, 1);
  }
  const dueAlertSummary = selectedEntries.reduce(
    (summary, entry) => {
      const dueState = supplierDebtDueState(
        entry.dueDate,
        entry.status,
        new Date(),
      );
      if (dueState === "OVERDUE") summary.overdue += 1;
      if (dueState === "DUE_SOON") summary.dueSoon += 1;
      return summary;
    },
    { overdue: 0, dueSoon: 0 },
  );
  const selectedDepositBalance = selectedSheet
    ? supplierDepositBalance(ledgerTransactions, selectedSheet.sheetKey)
    : 0;
  const recentTransactions = persistedTransactions
    .filter((transaction) => transaction.sheetKey === selectedSheet?.sheetKey)
    .slice(0, 10)
    .map((transaction) => ({
      id: transaction.id,
      sourceRow: transaction.sourceRow,
      kind: transaction.kind,
      paymentSource: transaction.paymentSource,
      amount: Number(transaction.amount),
      transactionDate: dateOnly(transaction.transactionDate) ?? "",
      reference: transaction.reference,
      note: transaction.note,
      hasProofImage: Boolean(transaction.proofImageUpdatedAt),
    }));
  const transactionsBySourceRow: Record<
    number,
    Array<{
      id: string;
      kind: "DEPOSIT" | "PAYMENT";
      paymentSource: "CASH" | "DEPOSIT" | null;
      amount: number;
      transactionDate: string;
      reference: string | null;
      note: string | null;
      hasProofImage: boolean;
    }>
  > = {};
  for (const transaction of persistedTransactions) {
    if (
      transaction.sheetKey !== selectedSheet?.sheetKey ||
      transaction.sourceRow == null
    )
      continue;
    const row = transaction.sourceRow;
    if (!transactionsBySourceRow[row]) transactionsBySourceRow[row] = [];
    transactionsBySourceRow[row].push({
      id: transaction.id,
      kind: transaction.kind,
      paymentSource: transaction.paymentSource,
      amount: Number(transaction.amount),
      transactionDate: dateOnly(transaction.transactionDate) ?? "",
      reference: transaction.reference,
      note: transaction.note,
      hasProofImage: Boolean(transaction.proofImageUpdatedAt),
    });
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
      sheets={allDetailSheets.map((sheet) => ({
        sheetKey: sheet.sheetKey,
        supplierName: sheet.supplierName,
        contactName: sheet.contactName,
        paymentTermDays: sheet.paymentTermDays,
        phone: sheet.phone,
        bankAccount: sheet.bankAccount,
        bankAccountName: sheet.bankAccountName,
        bankName: sheet.bankName,
        entryCount: entriesBySheet.get(sheet.sheetKey)?.length ?? 0,
      }))}
      selectedSheetKey={selectedSheet?.sheetKey ?? null}
      detailRows={
        view === "detail" ? detailRows.slice(start, start + PAGE_SIZE) : []
      }
      detailSummary={detailSummary}
      depositBalance={selectedDepositBalance}
      dueAlertSummary={dueAlertSummary}
      recentTransactions={recentTransactions}
      transactionsBySourceRow={transactionsBySourceRow}
      billLinesByInvoice={billLinesByInvoice}
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
