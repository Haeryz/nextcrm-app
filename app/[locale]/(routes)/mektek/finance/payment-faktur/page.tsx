import { Prisma } from "@prisma/client";

import { calculatePaymentFakturAmounts } from "@/lib/mektek/payment-faktur";
import {
  filterAndSortPaymentFakturRows,
  normalizePaymentFakturDirection,
  normalizePaymentFakturSort,
  normalizePaymentFakturStatus,
} from "@/lib/mektek/payment-faktur-table";
import { prismadb } from "@/lib/prisma";

import PaymentFakturManager, {
  type PaymentFakturCustomerOption,
  type PaymentFakturRow,
} from "../_components/PaymentFakturManager";
import { requireFinanceSection } from "../_lib/gate";

const PAGE_SIZE = 50;
const CUSTOMER_RESULT_LIMIT = 50;

type PaymentSummaryAggregate = {
  total: string | number | null;
  paid: string | number | null;
  remaining: string | number | null;
  paidCount: number;
  installmentCount: number;
  pendingCount: number;
};

type PaymentMonthlyAggregate = {
  month: number;
  total: string | number;
};

export default async function PaymentFakturPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    customer?: string;
    sheetQ?: string;
    q?: string;
    page?: string;
    status?: string;
    sort?: string;
    direction?: string;
  }>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
  const query = await searchParams;
  const sheetSearch = String(query.sheetQ ?? "").trim().slice(0, 100);
  const customerSelect = {
    id: true,
    sheetKey: true,
    customerName: true,
    taxLabelPercent: true,
    _count: { select: { entries: true } },
  } as const;
  const [customerMatches, requestedCustomer] = await Promise.all([
    prismadb.paymentFakturCustomer.findMany({
      where: sheetSearch
        ? {
            OR: [
              { sheetKey: { contains: sheetSearch, mode: "insensitive" } },
              { customerName: { contains: sheetSearch, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ position: "asc" }, { customerName: "asc" }],
      take: CUSTOMER_RESULT_LIMIT + 1,
      select: customerSelect,
    }),
    query.customer
      ? prismadb.paymentFakturCustomer.findUnique({
          where: { sheetKey: query.customer },
          select: customerSelect,
        })
      : null,
  ]);
  const hasMoreCustomerMatches = customerMatches.length > CUSTOMER_RESULT_LIMIT;
  const visibleCustomers = customerMatches.slice(0, CUSTOMER_RESULT_LIMIT);
  const selected = requestedCustomer ?? visibleCustomers[0] ?? null;
  const navigatorCustomers =
    selected && !visibleCustomers.some((customer) => customer.id === selected.id)
      ? [selected, ...visibleCustomers]
      : visibleCustomers;
  const search = String(query.q ?? "").trim().slice(0, 100);
  const statusFilter = normalizePaymentFakturStatus(query.status);
  const sort = normalizePaymentFakturSort(query.sort);
  const direction = normalizePaymentFakturDirection(query.direction);
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const where = selected
    ? {
        customerId: selected.id,
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" as const } },
                { receiptNumber: { contains: search, mode: "insensitive" as const } },
                { purchaseOrderNumber: { contains: search, mode: "insensitive" as const } },
                { destinationBank: { contains: search, mode: "insensitive" as const } },
                { taxInvoiceNumber: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
    : { id: "__empty__" };

  const [summaryAggregateRows, monthlyAggregateRows] = selected
    ? await Promise.all([
        prismadb.$queryRaw<PaymentSummaryAggregate[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("grandTotal"), 0) AS total,
            COALESCE(SUM("paidAmount"), 0) AS paid,
            COALESCE(SUM(GREATEST("grandTotal" - "paidAmount", 0)), 0) AS remaining,
            COUNT(*) FILTER (
              WHERE "grandTotal" > 0
                AND GREATEST("grandTotal" - "paidAmount", 0) = 0
            )::int AS "paidCount",
            COUNT(*) FILTER (
              WHERE "paidAmount" > 0
                AND GREATEST("grandTotal" - "paidAmount", 0) > 0
            )::int AS "installmentCount",
            COUNT(*) FILTER (WHERE "paidAmount" = 0)::int AS "pendingCount"
          FROM (
            SELECT
              "grandTotal",
              CASE
                WHEN "transferDate" IS NOT NULL THEN "grandTotal"
                ELSE LEAST(
                  "grandTotal",
                  "installment1" + "installment2" + "installment3"
                )
              END AS "paidAmount"
            FROM "PaymentFakturEntry"
            WHERE "customerId" = ${selected.id}::uuid
          ) AS calculated
        `),
        prismadb.$queryRaw<PaymentMonthlyAggregate[]>(Prisma.sql`
          SELECT
            EXTRACT(MONTH FROM "deliveryDate")::int AS month,
            COALESCE(SUM("grandTotal"), 0) AS total
          FROM "PaymentFakturEntry"
          WHERE "customerId" = ${selected.id}::uuid
            AND "deliveryDate" IS NOT NULL
          GROUP BY EXTRACT(MONTH FROM "deliveryDate")
          ORDER BY month
        `),
      ])
    : [[], []];
  const entries = selected
    ? await prismadb.paymentFakturEntry.findMany({
        where,
      })
    : [];

  const summaryAggregate = summaryAggregateRows[0];
  const monthlyTotals = Array.from({ length: 12 }, () => 0);
  for (const row of monthlyAggregateRows) {
    if (row.month >= 1 && row.month <= 12) {
      monthlyTotals[row.month - 1] = Number(row.total);
    }
  }
  const summary = {
    total: Number(summaryAggregate?.total ?? 0),
    paid: Number(summaryAggregate?.paid ?? 0),
    remaining: Number(summaryAggregate?.remaining ?? 0),
    LUNAS: summaryAggregate?.paidCount ?? 0,
    CICILAN: summaryAggregate?.installmentCount ?? 0,
    BELUM_BAYAR: summaryAggregate?.pendingCount ?? 0,
    monthlyTotals,
  };

  const customerOptions: PaymentFakturCustomerOption[] = navigatorCustomers.map((row) => ({
    id: row.id,
    sheetKey: row.sheetKey,
    customerName: row.customerName,
    taxLabelPercent: Number(row.taxLabelPercent),
    entryCount: row._count.entries,
  }));
  const allRows: PaymentFakturRow[] = entries.map((row) => {
    const amounts = calculatePaymentFakturAmounts({
      grandTotal: Number(row.grandTotal),
      transferDate: row.transferDate,
      installment1: Number(row.installment1),
      installment2: Number(row.installment2),
      installment3: Number(row.installment3),
    });
    return {
      id: row.id,
      sourceRow: row.sourceRow,
      receiptNumber: row.receiptNumber,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate?.toISOString().slice(0, 10) ?? null,
      purchaseOrderNumber: row.purchaseOrderNumber,
      destinationBank: row.destinationBank,
      deliveryDate: row.deliveryDate?.toISOString().slice(0, 10) ?? null,
      description: row.description,
      subtotal: Number(row.subtotal),
      taxAmount: Number(row.taxAmount),
      grandTotal: Number(row.grandTotal),
      transferDate: row.transferDate?.toISOString().slice(0, 10) ?? null,
      taxInvoiceNumber: row.taxInvoiceNumber,
      installment1: Number(row.installment1),
      installment2: Number(row.installment2),
      installment3: Number(row.installment3),
      ...amounts,
    };
  });
  const filteredRows = filterAndSortPaymentFakturRows(allRows, {
    status: statusFilter,
    sort,
    direction,
  });
  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const rows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <PaymentFakturManager
      customers={customerOptions}
      sheetSearch={sheetSearch}
      hasMoreCustomerMatches={hasMoreCustomerMatches}
      selectedCustomerId={selected?.id ?? null}
      selectedSheetKey={selected?.sheetKey ?? null}
      rows={rows}
      summary={summary}
      search={search}
      page={page}
      pageCount={pageCount}
      totalRows={totalRows}
      statusFilter={statusFilter}
      sort={sort}
      direction={direction}
    />
  );
}
