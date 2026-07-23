import "server-only";

import { Prisma, type FinanceCounterpartyRole } from "@prisma/client";

import { buildMektekFinancialSummary } from "@/lib/mektek/financials";
import { normalizeFinanceKey } from "@/lib/mektek/finance";

type FinanceTx = Prisma.TransactionClient;

function mergedRole(
  current: FinanceCounterpartyRole,
  requested: Exclude<FinanceCounterpartyRole, "BOTH">,
) {
  return current === requested || current === "BOTH" ? current : "BOTH";
}

export async function ensureFinanceCounterparty(
  tx: FinanceTx,
  legalName: string,
  role: Exclude<FinanceCounterpartyRole, "BOTH">,
) {
  const cleanName = legalName.replace(/\s+/g, " ").trim();
  const normalizedName = normalizeFinanceKey(cleanName);
  const existing = await tx.financeCounterparty.findUnique({
    where: { normalizedName },
  });
  if (existing) {
    const nextRole = mergedRole(existing.role, role);
    return nextRole === existing.role
      ? existing
      : tx.financeCounterparty.update({
          where: { id: existing.id },
          data: { role: nextRole },
        });
  }
  return tx.financeCounterparty.create({
    data: { legalName: cleanName, normalizedName, role },
  });
}

export async function syncOutboundDispatchBillingSource(
  tx: FinanceTx,
  input: { purchaseOrderId: string; dispatchReference: string; occurredAt: Date },
) {
  const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: {
      financeCounterparty: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          receipts: { where: { receivingReference: input.dispatchReference } },
        },
      },
    },
  });
  if (!purchaseOrder || purchaseOrder.flow !== "OUTBOUND") return null;
  const counterparty =
    purchaseOrder.financeCounterparty ??
    (await ensureFinanceCounterparty(tx, purchaseOrder.userName, "CUSTOMER"));
  if (!purchaseOrder.financeCounterpartyId) {
    await tx.logisticsPurchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { financeCounterpartyId: counterparty.id },
    });
  }

  const items = purchaseOrder.items.flatMap((item) => {
    const quantity = item.receipts.reduce((sum, receipt) => sum + receipt.quantity, 0);
    if (quantity <= 0) return [];
    return [{
      id: item.id,
      sourceLineKey: `${item.id}:${input.dispatchReference}`,
      kind: "SPARE_PART",
      name: item.partName,
      description: item.partName,
      partNumber: item.partNumber,
      quantity,
      unitPrice: item.agreedUnitPrice?.toString() ?? null,
    }];
  });
  const priced = items.every((item) => item.unitPrice != null);
  const subtotal = priced
    ? items.reduce(
        (sum, item) =>
          sum.add(new Prisma.Decimal(item.unitPrice!).mul(item.quantity)),
        new Prisma.Decimal(0),
      )
    : null;
  const sourceKey = `OUTBOUND:${purchaseOrder.id}:${input.dispatchReference}`;
  return tx.financeBillingSource.upsert({
    where: { sourceKey },
    create: {
      sourceType: "OUTBOUND_DISPATCH",
      sourceKey,
      sourceReference: input.dispatchReference,
      counterpartyId: counterparty.id,
      contractId: purchaseOrder.financeContractId,
      quoteId: purchaseOrder.financeQuoteId,
      status: priced ? "UNBILLED" : "NEEDS_REVIEW",
      occurredAt: input.occurredAt,
      paymentTermsDays: counterparty.paymentTermsDays,
      subtotal,
      totalAmount: subtotal,
      snapshot: {
        purchaseOrderId: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        deliveryNoteNumber: purchaseOrder.deliveryNoteNumber,
        dispatchReference: input.dispatchReference,
        poMode: purchaseOrder.poMode,
        projectName: purchaseOrder.projectName,
        items,
      },
    },
    update: {},
  });
}

export async function syncReceivingPayableSource(
  tx: FinanceTx,
  input: { purchaseOrderId: string; receivingReference: string; occurredAt: Date },
) {
  const purchaseOrder = await tx.logisticsPurchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: {
      financeCounterparty: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          receipts: { where: { receivingReference: input.receivingReference } },
        },
      },
    },
  });
  if (!purchaseOrder || purchaseOrder.flow !== "RECEIVING") return null;
  const counterparty =
    purchaseOrder.financeCounterparty ??
    (await ensureFinanceCounterparty(tx, purchaseOrder.supplierName, "SUPPLIER"));
  if (!purchaseOrder.financeCounterpartyId) {
    await tx.logisticsPurchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { financeCounterpartyId: counterparty.id },
    });
  }

  const items = purchaseOrder.items.flatMap((item) => {
    const quantity = item.receipts.reduce((sum, receipt) => sum + receipt.quantity, 0);
    if (quantity <= 0) return [];
    return [{
      id: item.id,
      sourceLineKey: `${item.id}:${input.receivingReference}`,
      name: item.partName,
      description: item.partName,
      partNumber: item.partNumber,
      quantity,
      unitCost: item.agreedUnitPrice?.toString() ?? null,
    }];
  });
  const priced = items.every((item) => item.unitCost != null);
  const total = priced
    ? items.reduce(
        (sum, item) =>
          sum.add(new Prisma.Decimal(item.unitCost!).mul(item.quantity)),
        new Prisma.Decimal(0),
      )
    : null;
  const sourceKey = `RECEIVING:${purchaseOrder.id}:${input.receivingReference}`;
  return tx.financePayableSource.upsert({
    where: { sourceKey },
    create: {
      sourceType: "RECEIVING_PO",
      sourceKey,
      sourceReference: input.receivingReference,
      counterpartyId: counterparty.id,
      status: priced ? "UNBILLED" : "NEEDS_REVIEW",
      occurredAt: input.occurredAt,
      subtotal: total,
      totalAmount: total,
      snapshot: {
        purchaseOrderId: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        projectName: purchaseOrder.projectName,
        items,
      },
    },
    update: {},
  });
}

export async function syncServiceOrderBillingSource(
  tx: FinanceTx,
  input: { serviceOrderId: string; force?: boolean },
) {
  const order = await tx.crm_Accounts_Tasks.findUnique({
    where: { id: input.serviceOrderId },
    include: { mektekPayments: true },
  });
  if (!order) return null;
  if (
    !input.force &&
    order.taskStatus !== "AWAITING_PAYMENT" &&
    order.taskStatus !== "COMPLETE"
  ) {
    return null;
  }
  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : {};
  const customerName = String(tags.customerName ?? "Pelanggan");
  const counterparty = await ensureFinanceCounterparty(tx, customerName, "CUSTOMER");
  const summary = buildMektekFinancialSummary(
    order.tags,
    order.content,
    order.mektekPayments,
  );
  const sourceKey = `SERVICE:${order.id}`;
  return tx.financeBillingSource.upsert({
    where: { sourceKey },
    create: {
      sourceType: "SERVICE_ORDER",
      sourceKey,
      sourceReference: order.serviceNumber ?? order.id,
      counterpartyId: counterparty.id,
      status: "UNBILLED",
      occurredAt: order.updatedAt ?? order.createdAt ?? new Date(),
      taxProfile: summary.customerType === "B2B" ? "PPN11_PPH2" : "NONE",
      paymentTermsDays: counterparty.paymentTermsDays,
      subtotal: new Prisma.Decimal(summary.subtotal),
      taxAmount: new Prisma.Decimal(summary.tax),
      withholdingAmount: new Prisma.Decimal(summary.pph),
      totalAmount: new Prisma.Decimal(summary.netPayable),
      snapshot: {
        serviceOrderId: order.id,
        serviceNumber: order.serviceNumber,
        customerType: summary.customerType,
        items: summary.normalizedItems.items.map((item) => ({
          id: item.catalogItemId ?? `${item.kind}:${item.name}`,
          sourceLineKey: item.catalogItemId ?? `${item.kind}:${item.name}`,
          kind: item.kind,
          name: item.name,
          description: item.name,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    update: {
      subtotal: new Prisma.Decimal(summary.subtotal),
      taxAmount: new Prisma.Decimal(summary.tax),
      withholdingAmount: new Prisma.Decimal(summary.pph),
      totalAmount: new Prisma.Decimal(summary.netPayable),
    },
  });
}

export async function syncPaidMektekPaymentToFinance(
  tx: FinanceTx,
  paymentId: string,
) {
  const payment = await tx.mektekPayment.findUnique({
    where: { id: paymentId },
    include: { serviceOrder: true },
  });
  if (!payment || !payment.paidAt) return null;
  const source = await syncServiceOrderBillingSource(tx, {
    serviceOrderId: payment.serviceOrderId,
    force: true,
  });
  if (!source) return null;

  let invoice = source.invoiceId
    ? await tx.financeInvoice.findUnique({
        where: { id: source.invoiceId },
        include: { allocations: { where: { receipt: { status: "POSTED" } } } },
      })
    : null;
  if (!invoice) {
    const snapshot = source.snapshot as Record<string, unknown>;
    const rawItems = Array.isArray(snapshot.items) ? snapshot.items : [];
    const lines = rawItems.flatMap((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      const quantity = new Prisma.Decimal(String(item.quantity ?? 0));
      const unitPrice = new Prisma.Decimal(String(item.unitPrice ?? 0));
      if (quantity.lte(0)) return [];
      return [{
        position: index + 1,
        kind: String(item.kind ?? "ITEM"),
        description: String(item.description ?? item.name ?? "Item"),
        partNumber: item.partNumber ? String(item.partNumber) : null,
        quantity,
        unitPrice,
        lineTotal: quantity.mul(unitPrice),
        sourceLineKey: String(item.sourceLineKey ?? index + 1),
      }];
    });
    const now = payment.paidAt ?? new Date();
    const netAmount = source.totalAmount ?? new Prisma.Decimal(payment.grossAmount);
    invoice = await tx.financeInvoice.create({
      data: {
        invoiceNumber:
          payment.serviceOrder.serviceNumber?.replace(/^SRV-/, "INV-") ??
          `INV-${payment.serviceOrderId.slice(0, 8)}`,
        counterpartyId: source.counterpartyId,
        status: "ISSUED",
        invoiceDate: now,
        dueDate: now,
        subtotal: source.subtotal ?? netAmount,
        taxAmount: source.taxAmount ?? 0,
        withholdingAmount: source.withholdingAmount ?? 0,
        grossAmount: (source.subtotal ?? netAmount).add(source.taxAmount ?? 0),
        netAmount,
        approvedAt: now,
        issuedAt: now,
        notes: "Trusted system-issued service invoice",
        lines: { create: lines },
      },
      include: { allocations: { where: { receipt: { status: "POSTED" } } } },
    });
    await tx.financeBillingSource.update({
      where: { id: source.id },
      data: { invoiceId: invoice.id, status: "BILLED" },
    });
    await tx.financeAuditEvent.create({
      data: {
        entityType: "INVOICE",
        entityId: invoice.id,
        action: "SYSTEM_ISSUE",
        metadata: { serviceOrderId: payment.serviceOrderId },
      },
    });
  }

  const existingReceipt = await tx.financeReceipt.findUnique({
    where: { providerPaymentId: payment.id },
  });
  if (existingReceipt) return { invoice, receipt: existingReceipt };
  const paidBefore = invoice.allocations.reduce(
    (sum, allocation) => sum.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  const remaining = Prisma.Decimal.max(invoice.netAmount.sub(paidBefore), 0);
  const allocationAmount = Prisma.Decimal.min(
    new Prisma.Decimal(payment.grossAmount),
    remaining,
  );
  const receipt = await tx.financeReceipt.create({
    data: {
      receiptNumber: `RCPT-MID-${payment.midtransOrderId}`.slice(0, 180),
      counterpartyId: invoice.counterpartyId,
      method: "MIDTRANS",
      amount: new Prisma.Decimal(payment.grossAmount),
      receivedAt: payment.paidAt,
      bankReference: payment.midtransOrderId,
      providerPaymentId: payment.id,
      notes: "Midtrans settlement",
      allocations: allocationAmount.gt(0)
        ? { create: [{ invoiceId: invoice.id, amount: allocationAmount }] }
        : undefined,
    },
  });
  const nextPaid = paidBefore.add(allocationAmount);
  await tx.financeInvoice.update({
    where: { id: invoice.id },
    data: { status: nextPaid.gte(invoice.netAmount) ? "PAID" : "PARTIALLY_PAID" },
  });
  await tx.financeAuditEvent.create({
    data: {
      entityType: "RECEIPT",
      entityId: receipt.id,
      action: "MIDTRANS_POST",
      metadata: { paymentId: payment.id, invoiceId: invoice.id },
    },
  });
  return { invoice, receipt };
}
