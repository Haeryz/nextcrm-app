import { prismadb } from "@/lib/prisma";
import { parseSupplierPayableSnapshot } from "@/lib/mektek/supplier-payment";

import SupplierPaymentManager, {
  type SupplierPaymentRow,
  type SupplierPaymentSource,
} from "../_components/SupplierPaymentManager";

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export default async function SupplierPaymentsPage() {
  const [payableSources, supplierBills] = await Promise.all([
    prismadb.financePayableSource.findMany({
      where: {
        supplierBillId: null,
        status: { in: ["UNBILLED", "NEEDS_REVIEW"] },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        counterparty: { select: { legalName: true } },
      },
    }),
    prismadb.financeSupplierBill.findMany({
      orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        counterparty: { select: { legalName: true } },
        sources: {
          select: {
            sourceReference: true,
            snapshot: true,
          },
          take: 1,
        },
        allocations: {
          where: { disbursement: { status: "POSTED" } },
          select: { amount: true },
        },
      },
    }),
  ]);

  const sources: SupplierPaymentSource[] = payableSources.map((source) => {
    const snapshot = parseSupplierPayableSnapshot(source.snapshot);
    return {
      id: source.id,
      supplierName: source.counterparty.legalName,
      receivingReference: source.sourceReference,
      receivedAt: dateOnly(source.occurredAt),
      poNumber: snapshot.poNumber,
      projectName: snapshot.projectName,
      pricingComplete: snapshot.pricingComplete,
      expectedSubtotal: snapshot.expectedSubtotal,
      lines: snapshot.lines.map((line) => ({
        description: line.description,
        partNumber: line.partNumber,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineTotal: line.lineTotal,
      })),
    };
  });

  const rows: SupplierPaymentRow[] = supplierBills.map((bill) => {
    const source = bill.sources[0];
    const snapshot = parseSupplierPayableSnapshot(source?.snapshot);
    const paid = bill.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0,
    );
    return {
      id: bill.id,
      internalNumber: bill.internalNumber,
      supplierName: bill.counterparty.legalName,
      supplierInvoiceNumber: bill.supplierInvoiceNumber,
      receivingReference: source?.sourceReference ?? "",
      poNumber: snapshot.poNumber,
      billDate: dateOnly(bill.billDate),
      dueDate: dateOnly(bill.dueDate),
      subtotal: Number(bill.subtotal),
      taxAmount: Number(bill.taxAmount),
      grandTotal: Number(bill.totalAmount),
      remainingAmount: Math.max(0, Number(bill.totalAmount) - paid),
      status: bill.status,
      matchException: bill.matchException,
    };
  });

  return <SupplierPaymentManager sources={sources} rows={rows} />;
}
