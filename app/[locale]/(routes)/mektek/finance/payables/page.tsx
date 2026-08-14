import { prismadb } from "@/lib/prisma";
import { parseSupplierPayableSnapshot } from "@/lib/mektek/supplier-payment";

import SupplierPaymentManager, {
  type SupplierPaymentRow,
  type SupplierPaymentSource,
} from "../_components/SupplierPaymentManager";
import { requireFinanceSection } from "../_lib/gate";

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export default async function SupplierPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "finance");
  const [payableSources, supplierBills] = await Promise.all([
    prismadb.financePayableSource.findMany({
      where: {
        supplierBillId: null,
        status: { in: ["UNBILLED", "NEEDS_REVIEW"] },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        counterparty: { select: { legalName: true, paymentTermsDays: true } },
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
            occurredAt: true,
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

  const parsedPayableSources = payableSources.map((source) => ({
    source,
    snapshot: parseSupplierPayableSnapshot(source.snapshot),
  }));
  const purchaseOrderIds = parsedPayableSources.flatMap(({ snapshot }) =>
    snapshot.purchaseOrderId ? [snapshot.purchaseOrderId] : [],
  );
  const purchaseOrderDocuments =
    purchaseOrderIds.length > 0
      ? await prismadb.logisticsPurchaseOrder.findMany({
          where: { id: { in: purchaseOrderIds }, flow: "RECEIVING" },
          select: {
            id: true,
            supplierInvoiceImageUpdatedAt: true,
            deliveryNoteImageUpdatedAt: true,
            mektekDeliveryNoteImageUpdatedAt: true,
            receivingDeliveryNoteSource: true,
            signedPoImageUpdatedAt: true,
          },
        })
      : [];
  const documentsByPurchaseOrderId = new Map(
    purchaseOrderDocuments.map((purchaseOrder) => [
      purchaseOrder.id,
      purchaseOrder,
    ]),
  );

  const sources: SupplierPaymentSource[] = parsedPayableSources.map(
    ({ source, snapshot }) => {
      const documents = snapshot.purchaseOrderId
        ? documentsByPurchaseOrderId.get(snapshot.purchaseOrderId)
        : undefined;
    return {
      id: source.id,
      purchaseOrderId: snapshot.purchaseOrderId,
      supplierName: source.counterparty.legalName,
      receivingReference: source.sourceReference,
      receivedAt: dateOnly(source.occurredAt),
      poNumber: snapshot.poNumber,
      projectName: snapshot.projectName,
      pricingComplete: snapshot.pricingComplete,
      supplierInvoiceImageAvailable: Boolean(
        documents?.supplierInvoiceImageUpdatedAt,
      ),
      deliveryNoteImageAvailable: Boolean(
        documents?.deliveryNoteImageUpdatedAt ||
          documents?.receivingDeliveryNoteSource === "MEKTEK",
      ),
      mektekDeliveryNoteImageAvailable: Boolean(
        documents?.mektekDeliveryNoteImageUpdatedAt,
      ),
      receivingDeliveryNoteSource:
        documents?.receivingDeliveryNoteSource ?? null,
      signedPoImageAvailable: Boolean(
        documents?.signedPoImageUpdatedAt,
      ),
      expectedSubtotal: snapshot.expectedSubtotal,
      paymentTermsDays: source.counterparty.paymentTermsDays,
      pricingIssues: snapshot.pricingIssues,
      lines: snapshot.lines.map((line) => ({
        description: line.description,
        partNumber: line.partNumber,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineTotal: line.lineTotal,
      })),
    };
    },
  );

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
      receivedAt: source ? dateOnly(source.occurredAt) : "",
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
