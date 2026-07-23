import { calculatePaymentFakturAmounts } from "@/lib/mektek/payment-faktur";
import { prismadb } from "@/lib/prisma";

import PaymentFakturManager, {
  type PaymentFakturCustomerOption,
  type PaymentFakturRow,
} from "../_components/PaymentFakturManager";

const PAGE_SIZE = 50;

export default async function PaymentFakturPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const customers = await prismadb.paymentFakturCustomer.findMany({
    orderBy: [{ position: "asc" }, { customerName: "asc" }],
    select: {
      id: true,
      sheetKey: true,
      customerName: true,
      taxLabelPercent: true,
      _count: { select: { entries: true } },
    },
  });
  const selected =
    customers.find((customer) => customer.sheetKey === query.customer) ??
    customers[0] ??
    null;
  const search = String(query.q ?? "").trim().slice(0, 100);
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
                { taxInvoiceNumber: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
    : { id: "__empty__" };

  const [totalRows, summaryRows] = selected
    ? await Promise.all([
        prismadb.paymentFakturEntry.count({ where }),
        prismadb.paymentFakturEntry.findMany({
          where: { customerId: selected.id },
          select: {
            grandTotal: true,
            deliveryDate: true,
            transferDate: true,
            installment1: true,
            installment2: true,
            installment3: true,
          },
        }),
      ])
    : [0, []];
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const entries = selected
    ? await prismadb.paymentFakturEntry.findMany({
        where,
        orderBy: [{ invoiceDate: "desc" }, { sourceRow: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })
    : [];

  const summary = summaryRows.reduce(
    (result, row) => {
      const amounts = calculatePaymentFakturAmounts({
        grandTotal: Number(row.grandTotal),
        transferDate: row.transferDate,
        installment1: Number(row.installment1),
        installment2: Number(row.installment2),
        installment3: Number(row.installment3),
      });
      result.total += Number(row.grandTotal);
      result.paid += amounts.paidAmount;
      result.remaining += amounts.remainingAmount;
      result[amounts.status] += 1;
      if (row.deliveryDate) {
        result.monthlyTotals[row.deliveryDate.getUTCMonth()] += Number(row.grandTotal);
      }
      return result;
    },
    {
      total: 0,
      paid: 0,
      remaining: 0,
      LUNAS: 0,
      CICILAN: 0,
      BELUM_BAYAR: 0,
      monthlyTotals: Array.from({ length: 12 }, () => 0),
    },
  );

  const customerOptions: PaymentFakturCustomerOption[] = customers.map((row) => ({
    id: row.id,
    sheetKey: row.sheetKey,
    customerName: row.customerName,
    taxLabelPercent: Number(row.taxLabelPercent),
    entryCount: row._count.entries,
  }));
  const rows: PaymentFakturRow[] = entries.map((row) => {
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

  return (
    <PaymentFakturManager
      customers={customerOptions}
      selectedCustomerId={selected?.id ?? null}
      selectedSheetKey={selected?.sheetKey ?? null}
      rows={rows}
      summary={summary}
      search={search}
      page={page}
      pageCount={pageCount}
      totalRows={totalRows}
    />
  );
}
