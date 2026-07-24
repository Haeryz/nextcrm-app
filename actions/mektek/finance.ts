"use server";

import { createHash, randomBytes } from "node:crypto";
import {
  FinanceApprovalAction,
  FinanceApprovalStatus,
  FinanceInvoiceStatus,
  FinancePaymentMethod,
  FinanceSourceStatus,
  FinanceSupplierBillStatus,
  Prisma,
  type FinanceContractType,
  type FinanceCounterpartyRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  canApproveMektekFinance,
  canManageMektekFinance,
} from "@/lib/mektek/permissions";
import {
  canApproveFinanceRequest,
  classifyFinanceRevenueLine,
  normalizeFinanceKey,
  validateBillingSourceGrouping,
} from "@/lib/mektek/finance";
import {
  buildFinancePurchaseOrderDeliveryNoteSuggestion,
  buildFinancePurchaseOrderSuggestion,
  shouldSearchFinancePurchaseOrders,
  type FinancePurchaseOrderSuggestion,
} from "@/lib/mektek/finance-po";
import { isFinanceDestinationBank } from "@/lib/mektek/finance-bank-accounts";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

type FinanceTx = Prisma.TransactionClient;

const text = (value: unknown, max = 250) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const dateOnly = (value: unknown) => {
  const raw = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const money = (value: unknown) => {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? new Prisma.Decimal(parsed.toFixed(2))
    : null;
};

const numberValue = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(value ?? 0);

const financePath = "/[locale]/(routes)/mektek/finance";

async function ensureFinanceManager(approval = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  const allowed = approval
    ? canApproveMektekFinance(session.user)
    : canManageMektekFinance(session.user);
  if (!allowed) return { error: "Forbidden: akses Finance diperlukan" } as const;

  const current = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: { id: true, is_admin: true, staffDivision: true, userStatus: true },
  });
  if (
    !current ||
    current.userStatus !== "ACTIVE" ||
    (!current.is_admin && current.staffDivision !== "FINANCE")
  ) {
    return { error: "Forbidden: akses Finance sudah berubah" } as const;
  }
  return { session, current } as const;
}

async function nextDocumentNumber(
  tx: FinanceTx,
  kind: "INV" | "RCPT" | "BILL" | "PAY" | "QUO",
  at = new Date(),
) {
  const periodKey = `${at.getUTCFullYear()}${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
  const sequence = await tx.financeDocumentSequence.upsert({
    where: { kind_periodKey: { kind, periodKey } },
    create: { kind, periodKey, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return `${kind}-${periodKey}-${String(sequence.nextValue - 1).padStart(4, "0")}`;
}

async function audit(
  tx: FinanceTx,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.financeAuditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId ?? null,
      before: input.before,
      after: input.after,
      metadata: input.metadata,
    },
  });
}

const parseSnapshotLines = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const items = (snapshot as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const quantity = money(row.quantity);
    const unitPrice = money(row.unitPrice ?? row.unitCost);
    if (!quantity || !unitPrice || quantity.lte(0)) return [];
    return [{
      position: index + 1,
      kind: text(row.kind || "ITEM", 40),
      description: text(row.description ?? row.name, 500),
      partNumber: text(row.partNumber, 120) || null,
      quantity,
      unitPrice,
      lineTotal: quantity.mul(unitPrice),
      sourceLineKey: text(row.sourceLineKey ?? row.id, 180) || null,
    }];
  });
};

export async function createFinanceCounterparty(input: {
  legalName: string;
  role: FinanceCounterpartyRole;
  taxId?: string;
  billingAddress?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  paymentTermsDays?: number;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const legalName = text(input.legalName, 180);
  const normalizedName = normalizeFinanceKey(legalName);
  if (!legalName || !normalizedName) return { error: "Nama perusahaan wajib diisi" };

  try {
    const row = await prismadb.$transaction(async (tx) => {
      const counterparty = await tx.financeCounterparty.create({
        data: {
          legalName,
          normalizedName,
          role: input.role,
          taxId: text(input.taxId, 80) || null,
          billingAddress: text(input.billingAddress, 1000) || null,
          contactName: text(input.contactName, 180) || null,
          phone: text(input.phone, 40) || null,
          email: text(input.email, 180) || null,
          paymentTermsDays:
            Number.isInteger(input.paymentTermsDays) && Number(input.paymentTermsDays) >= 0
              ? Number(input.paymentTermsDays)
              : null,
        },
      });
      await audit(tx, {
        entityType: "COUNTERPARTY",
        entityId: counterparty.id,
        action: "CREATE",
        actorId: access.current.id,
        after: { legalName, role: input.role },
      });
      return counterparty;
    });
    revalidatePath(financePath, "layout");
    return { data: row };
  } catch (error) {
    console.error("[CREATE_FINANCE_COUNTERPARTY]", error);
    return { error: "Perusahaan sudah ada atau data tidak valid" };
  }
}

export async function createFinanceContract(input: {
  counterpartyId: string;
  contractNumber: string;
  type: FinanceContractType;
  projectName?: string;
  siteName?: string;
  startDate: string;
  endDate: string;
  ownerId?: string;
  notes?: string;
  lines?: Array<{
    catalogItemId?: string;
    itemName: string;
    partNumber?: string;
    quantity?: number;
    unitPrice?: string | number;
  }>;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const contractNumber = text(input.contractNumber, 160);
  const startDate = dateOnly(input.startDate);
  const endDate = dateOnly(input.endDate);
  if (!contractNumber || !startDate || !endDate || endDate < startDate) {
    return { error: "Nomor dan periode kontrak tidak valid" };
  }
  const lines = (input.lines ?? []).map((line, index) => ({
    position: index + 1,
    catalogItemId: text(line.catalogItemId, 180) || null,
    itemName: text(line.itemName, 300),
    partNumber: text(line.partNumber, 120) || null,
    itemKey: normalizeFinanceKey(line.catalogItemId || line.partNumber || line.itemName),
    contractedQuantity:
      Number.isInteger(line.quantity) && Number(line.quantity) > 0 ? Number(line.quantity) : null,
    unitPrice: money(line.unitPrice),
  }));
  if (input.type === "CONSIGNMENT" && lines.length === 0) {
    return { error: "Kontrak Consignment wajib memiliki item dan batas suplai" };
  }

  try {
    const contract = await prismadb.$transaction(async (tx) => {
      const created = await tx.financeContract.create({
        data: {
          counterpartyId: input.counterpartyId,
          contractNumber,
          normalizedNumber: normalizeFinanceKey(contractNumber),
          type: input.type,
          projectName: text(input.projectName, 180) || null,
          siteName: text(input.siteName, 180) || null,
          startDate,
          endDate,
          ownerId: text(input.ownerId, 36) || null,
          notes: text(input.notes, 1500) || null,
          createdBy: access.current.id,
          lines: { create: lines },
        },
        include: { counterparty: true, lines: true },
      });
      await audit(tx, {
        entityType: "CONTRACT",
        entityId: created.id,
        action: "CREATE_DRAFT",
        actorId: access.current.id,
        after: {
          contractNumber,
          type: input.type,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          lineCount: lines.length,
        },
      });
      return created;
    });
    revalidatePath(financePath, "layout");
    return { data: contract };
  } catch (error) {
    console.error("[CREATE_FINANCE_CONTRACT]", error);
    return { error: "Gagal membuat kontrak" };
  }
}

export async function activateFinanceContract(contractId: string) {
  const access = await ensureFinanceManager(true);
  if ("error" in access) return access;
  const signedDocument = await prismadb.financeAttachment.findFirst({
    where: { entityType: "CONTRACT", entityId: contractId, kind: "SIGNED_CONTRACT" },
    select: { id: true },
  });
  if (!signedDocument) return { error: "Dokumen kontrak bertanda tangan wajib diunggah" };

  const contract = await prismadb.$transaction(async (tx) => {
    const updated = await tx.financeContract.update({
      where: { id: contractId, status: "DRAFT" },
      data: { status: "ACTIVE", signedAt: new Date() },
    });
    await audit(tx, {
      entityType: "CONTRACT",
      entityId: contractId,
      action: "ACTIVATE",
      actorId: access.current.id,
    });
    return updated;
  });
  revalidatePath(financePath, "layout");
  return { data: contract };
}

export async function createFinanceQuote(input: {
  counterpartyId: string;
  projectName?: string;
  validFrom: string;
  validUntil: string;
  notes?: string;
  lines: Array<{
    catalogItemId?: string;
    itemName: string;
    partNumber?: string;
    quantity?: number;
    unitPrice: string | number;
  }>;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const validFrom = dateOnly(input.validFrom);
  const validUntil = dateOnly(input.validUntil);
  if (!validFrom || !validUntil || validUntil < validFrom || input.lines.length === 0) {
    return { error: "Periode dan item penawaran wajib diisi" };
  }
  const normalizedLines = input.lines.flatMap((line, index) => {
    const unitPrice = money(line.unitPrice);
    const itemName = text(line.itemName, 300);
    if (!unitPrice || unitPrice.lte(0) || !itemName) return [];
    return [{
      position: index + 1,
      catalogItemId: text(line.catalogItemId, 180) || null,
      itemName,
      partNumber: text(line.partNumber, 120) || null,
      itemKey: normalizeFinanceKey(line.catalogItemId || line.partNumber || itemName),
      quantity:
        Number.isInteger(line.quantity) && Number(line.quantity) > 0 ? Number(line.quantity) : null,
      unitPrice,
    }];
  });
  if (normalizedLines.length !== input.lines.length) {
    return { error: "Semua item penawaran memerlukan nama dan harga positif" };
  }

  const quote = await prismadb.$transaction(async (tx) => {
    const quoteNumber = await nextDocumentNumber(tx, "QUO", validFrom);
    const created = await tx.financeQuote.create({
      data: {
        quoteNumber,
        counterpartyId: input.counterpartyId,
        projectName: text(input.projectName, 180) || null,
        validFrom,
        validUntil,
        notes: text(input.notes, 1500) || null,
        createdBy: access.current.id,
        lines: { create: normalizedLines },
      },
      include: { lines: true, counterparty: true },
    });
    await audit(tx, {
      entityType: "QUOTE",
      entityId: created.id,
      action: "CREATE_DRAFT",
      actorId: access.current.id,
      after: { quoteNumber, lineCount: normalizedLines.length },
    });
    return created;
  });
  revalidatePath(financePath, "layout");
  return { data: quote };
}

export async function submitFinanceQuoteForApproval(quoteId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const approval = await prismadb.$transaction(async (tx) => {
    await tx.financeQuote.update({ where: { id: quoteId }, data: { status: "PENDING_APPROVAL" } });
    const request = await tx.financeApproval.create({
      data: {
        action: "APPROVE_QUOTE",
        entityType: "QUOTE",
        entityId: quoteId,
        requestedBy: access.current.id,
      },
    });
    await audit(tx, { entityType: "QUOTE", entityId: quoteId, action: "REQUEST_APPROVAL", actorId: access.current.id });
    return request;
  });
  revalidatePath(financePath, "layout");
  return { data: approval };
}

export async function createFinanceInvoiceDraft(sourceIds: string[]) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const ids = [...new Set(sourceIds.map((id) => text(id, 36)).filter(Boolean))];
  if (ids.length === 0) return { error: "Pilih minimal satu sumber tagihan" };

  try {
    const invoice = await prismadb.$transaction(async (tx) => {
      const sources = await tx.financeBillingSource.findMany({
        where: { id: { in: ids }, status: "UNBILLED", invoiceId: null },
        orderBy: { occurredAt: "asc" },
      });
      if (sources.length !== ids.length) throw new Error("SOURCE_UNAVAILABLE");
      const grouping = validateBillingSourceGrouping(
        sources.map((source) => ({
          counterpartyId: source.counterpartyId,
          currency: source.currency,
          taxProfile: source.taxProfile,
          paymentTermsDays: source.paymentTermsDays,
          contractId: source.contractId,
        })),
      );
      if (!grouping.ok) throw new Error(grouping.reason);

      const lines = sources.flatMap((source) => parseSnapshotLines(source.snapshot));
      if (lines.length === 0) throw new Error("SOURCE_UNPRICED");
      const subtotal = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
      const taxAmount = sources.reduce((sum, source) => sum.add(source.taxAmount ?? 0), new Prisma.Decimal(0));
      const withholdingAmount = sources.reduce(
        (sum, source) => sum.add(source.withholdingAmount ?? 0),
        new Prisma.Decimal(0),
      );
      const first = sources[0];
      const dueDate = first.paymentTermsDays == null
        ? null
        : new Date(Date.now() + first.paymentTermsDays * 86_400_000);
      const created = await tx.financeInvoice.create({
        data: {
          counterpartyId: first.counterpartyId,
          contractId: first.contractId,
          currency: first.currency,
          dueDate,
          subtotal,
          taxAmount,
          withholdingAmount,
          grossAmount: subtotal.add(taxAmount),
          netAmount: subtotal.add(taxAmount).sub(withholdingAmount),
          requestedBy: access.current.id,
          lines: { create: lines.map((line, index) => ({ ...line, position: index + 1 })) },
        },
        include: { counterparty: true, lines: true },
      });
      await tx.financeBillingSource.updateMany({
        where: { id: { in: ids } },
        data: { invoiceId: created.id, status: "DRAFTED" },
      });
      await audit(tx, {
        entityType: "INVOICE",
        entityId: created.id,
        action: "CREATE_DRAFT",
        actorId: access.current.id,
        after: { sourceIds: ids, netAmount: created.netAmount.toString() },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath(financePath, "layout");
    return { data: invoice };
  } catch (error) {
    console.error("[CREATE_FINANCE_INVOICE_DRAFT]", error);
    const reason = error instanceof Error ? error.message : "";
    return {
      error:
        reason === "SOURCE_UNPRICED"
          ? "Sumber tagihan belum memiliki harga yang disetujui"
          : "Sumber tagihan tidak tersedia atau tidak kompatibel",
    };
  }
}

export type FinanceInvoiceEntryInput = {
  customerName: string;
  deliveryNoteNumber?: string;
  deliveryNoteDate?: string;
  receiptNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrderNumber?: string;
  purchaseOrderDate?: string;
  description: string;
  subtotal: number | string;
  taxRate?: number | string;
  taxInvoiceNumber?: string;
  accountDestination?: string;
  notes?: string;
  sourceIds?: string[];
};

export async function searchFinancePurchaseOrders(input: {
  query?: string;
  invoiceId?: string;
}): Promise<
  { data: FinancePurchaseOrderSuggestion[] } | { error: string }
> {
  const access = await ensureFinanceManager();
  if ("error" in access && access.error) return { error: access.error };
  const query = text(input?.query, 80);
  const invoiceId = text(input?.invoiceId, 36);
  if (!shouldSearchFinancePurchaseOrders(query)) return { data: [] };

  const purchaseOrders = await prismadb.logisticsPurchaseOrder.findMany({
    where: {
      flow: "OUTBOUND",
      poNumber: { contains: query, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      poNumber: true,
      poMode: true,
      userName: true,
      projectName: true,
      inputDate: true,
      dueDate: true,
      deliveryNoteNumber: true,
      deliveryDate: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          partName: true,
          partNumber: true,
          orderedQuantity: true,
          agreedUnitPrice: true,
        },
      },
    },
  });
  const billingSources = purchaseOrders.length
    ? await prismadb.financeBillingSource.findMany({
        where: {
          sourceType: "OUTBOUND_DISPATCH",
          AND: [
            {
              OR: purchaseOrders.map((row) => ({
                sourceKey: { startsWith: `OUTBOUND:${row.id}:` },
              })),
            },
          ],
        },
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          sourceKey: true,
          sourceReference: true,
          occurredAt: true,
          subtotal: true,
          snapshot: true,
          invoiceId: true,
          status: true,
        },
      })
    : [];
  const purchaseOrderIds = new Set(purchaseOrders.map((row) => row.id));
  const deliveryNotesByPurchaseOrder = new Map<
    string,
    ReturnType<typeof buildFinancePurchaseOrderDeliveryNoteSuggestion>[]
  >();
  const deliveryNoteCountByPurchaseOrder = new Map<string, number>();
  for (const source of billingSources) {
    const purchaseOrderId = source.sourceKey.split(":")[1] ?? "";
    if (!purchaseOrderIds.has(purchaseOrderId)) continue;
    deliveryNoteCountByPurchaseOrder.set(
      purchaseOrderId,
      (deliveryNoteCountByPurchaseOrder.get(purchaseOrderId) ?? 0) + 1,
    );
    const available =
      (source.invoiceId == null &&
        (source.status === "UNBILLED" ||
          source.status === "NEEDS_REVIEW")) ||
      (invoiceId && source.invoiceId === invoiceId);
    if (!available) continue;
    const values = deliveryNotesByPurchaseOrder.get(purchaseOrderId) ?? [];
    values.push(buildFinancePurchaseOrderDeliveryNoteSuggestion(source));
    deliveryNotesByPurchaseOrder.set(purchaseOrderId, values);
  }
  const normalizedQuery = query.toLocaleLowerCase("id-ID");
  const suggestions = purchaseOrders
    .sort((left, right) => {
      const leftNumber = left.poNumber.toLocaleLowerCase("id-ID");
      const rightNumber = right.poNumber.toLocaleLowerCase("id-ID");
      const leftRank = leftNumber === normalizedQuery
        ? 0
        : leftNumber.startsWith(normalizedQuery)
          ? 1
          : 2;
      const rightRank = rightNumber === normalizedQuery
        ? 0
        : rightNumber.startsWith(normalizedQuery)
          ? 1
          : 2;
      return leftRank - rightRank || leftNumber.localeCompare(rightNumber, "id-ID");
    })
    .slice(0, 8)
    .map((purchaseOrder) =>
      buildFinancePurchaseOrderSuggestion(
        purchaseOrder,
        deliveryNotesByPurchaseOrder.get(purchaseOrder.id) ?? [],
        deliveryNoteCountByPurchaseOrder.get(purchaseOrder.id) ?? 0,
      ),
    );

  return { data: suggestions };
}

function parseInvoiceEntry(input: FinanceInvoiceEntryInput) {
  const customerName = text(input.customerName, 180);
  const normalizedName = normalizeFinanceKey(customerName);
  const invoiceNumber = text(input.invoiceNumber, 80);
  const invoiceDate = dateOnly(input.invoiceDate);
  const dueDate = input.dueDate ? dateOnly(input.dueDate) : null;
  const deliveryNoteDate = input.deliveryNoteDate ? dateOnly(input.deliveryNoteDate) : null;
  const purchaseOrderDate = input.purchaseOrderDate ? dateOnly(input.purchaseOrderDate) : null;
  const description = text(input.description, 5000);
  const subtotal = money(input.subtotal);
  const rawTaxRate = Number(String(input.taxRate ?? 11).replace(",", "."));
  const accountDestination = text(input.accountDestination, 180);

  if (!customerName || !normalizedName) return { error: "Nama customer wajib diisi" } as const;
  if (!invoiceNumber) return { error: "Nomor invoice wajib diisi" } as const;
  if (!invoiceDate) return { error: "Tanggal invoice tidak valid" } as const;
  if (input.dueDate && !dueDate) return { error: "Tanggal jatuh tempo tidak valid" } as const;
  if (input.deliveryNoteDate && !deliveryNoteDate) return { error: "Tanggal surat jalan tidak valid" } as const;
  if (input.purchaseOrderDate && !purchaseOrderDate) return { error: "Tanggal PO tidak valid" } as const;
  if (!description) return { error: "Deskripsi pekerjaan atau barang wajib diisi" } as const;
  if (!subtotal || subtotal.lte(0)) return { error: "Nilai sebelum pajak harus lebih dari 0" } as const;
  if (!Number.isFinite(rawTaxRate) || rawTaxRate < 0 || rawTaxRate > 100) {
    return { error: "PPN harus berada di antara 0 dan 100 persen" } as const;
  }
  if (
    accountDestination &&
    !isFinanceDestinationBank(accountDestination)
  ) {
    return { error: "Rekening tujuan tidak valid" } as const;
  }

  const taxRate = new Prisma.Decimal((rawTaxRate / 100).toFixed(6));
  const taxAmount = subtotal.mul(taxRate).toDecimalPlaces(2);
  const total = subtotal.add(taxAmount);
  return {
    data: {
      customerName,
      normalizedName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      deliveryNoteNumber: text(input.deliveryNoteNumber, 1000) || null,
      deliveryNoteDate,
      receiptNumber: text(input.receiptNumber, 80) || null,
      purchaseOrderNumber: text(input.purchaseOrderNumber, 1000) || null,
      purchaseOrderDate,
      description,
      subtotal,
      taxRate,
      taxAmount,
      total,
      taxInvoiceNumber: text(input.taxInvoiceNumber, 100) || null,
      accountDestination: accountDestination || null,
      notes: text(input.notes, 1000) || null,
      sourceIds:
        input.sourceIds === undefined
          ? undefined
          : [
              ...new Set(
                input.sourceIds.map((id) => text(id, 36)).filter(Boolean),
              ),
            ],
    },
  } as const;
}

async function validateInvoiceBillingSources(
  tx: FinanceTx,
  sourceIds: string[],
  counterpartyId: string,
  invoiceId?: string,
) {
  if (sourceIds.length === 0) return [];
  const sources = await tx.financeBillingSource.findMany({
    where: {
      id: { in: sourceIds },
      sourceType: "OUTBOUND_DISPATCH",
      OR: [
        {
          invoiceId: null,
          status: { in: ["UNBILLED", "NEEDS_REVIEW"] },
        },
        ...(invoiceId ? [{ invoiceId }] : []),
      ],
    },
    select: { id: true, counterpartyId: true },
  });
  if (
    sources.length !== sourceIds.length ||
    sources.some((source) => source.counterpartyId !== counterpartyId)
  ) {
    throw new Error("SOURCE_MISMATCH");
  }
  return sources;
}

async function syncInvoiceBillingSources(
  tx: FinanceTx,
  invoiceId: string,
  sourceIds: string[],
) {
  const removed = await tx.financeBillingSource.findMany({
    where: {
      invoiceId,
      ...(sourceIds.length ? { id: { notIn: sourceIds } } : {}),
    },
    select: { id: true, subtotal: true },
  });
  const pricedRemovedIds = removed
    .filter((source) => source.subtotal != null)
    .map((source) => source.id);
  const unpricedRemovedIds = removed
    .filter((source) => source.subtotal == null)
    .map((source) => source.id);
  if (pricedRemovedIds.length) {
    await tx.financeBillingSource.updateMany({
      where: { id: { in: pricedRemovedIds } },
      data: { invoiceId: null, status: "UNBILLED" },
    });
  }
  if (unpricedRemovedIds.length) {
    await tx.financeBillingSource.updateMany({
      where: { id: { in: unpricedRemovedIds } },
      data: { invoiceId: null, status: "NEEDS_REVIEW" },
    });
  }
  if (sourceIds.length) {
    await tx.financeBillingSource.updateMany({
      where: { id: { in: sourceIds } },
      data: { invoiceId, status: "BILLED" },
    });
  }
}

export async function createFinanceInvoiceEntry(input: FinanceInvoiceEntryInput) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const parsed = parseInvoiceEntry(input);
  if ("error" in parsed) return parsed;
  const value = parsed.data;

  try {
    const row = await prismadb.$transaction(async (tx) => {
      const counterparty = await tx.financeCounterparty.upsert({
        where: { normalizedName: value.normalizedName },
        create: {
          legalName: value.customerName,
          normalizedName: value.normalizedName,
          role: "CUSTOMER",
          isActive: true,
        },
        update: { isActive: true },
      });
      const sourceIds = value.sourceIds ?? [];
      await validateInvoiceBillingSources(tx, sourceIds, counterparty.id);
      const created = await tx.financeInvoice.create({
        data: {
          invoiceNumber: value.invoiceNumber,
          counterpartyId: counterparty.id,
          status: "ISSUED",
          invoiceDate: value.invoiceDate,
          dueDate: value.dueDate,
          deliveryNoteNumber: value.deliveryNoteNumber,
          deliveryNoteDate: value.deliveryNoteDate,
          receiptNumber: value.receiptNumber,
          purchaseOrderNumber: value.purchaseOrderNumber,
          purchaseOrderDate: value.purchaseOrderDate,
          accountDestination: value.accountDestination,
          subtotal: value.subtotal,
          taxRate: value.taxRate,
          taxAmount: value.taxAmount,
          grossAmount: value.total,
          netAmount: value.total,
          taxInvoiceNumber: value.taxInvoiceNumber,
          notes: value.notes,
          requestedBy: access.current.id,
          issuedAt: new Date(),
          lines: {
            create: {
              position: 1,
              kind: classifyFinanceRevenueLine({
                kind: "MANUAL",
                description: value.description,
              }),
              description: value.description,
              quantity: 1,
              unitPrice: value.subtotal,
              lineTotal: value.subtotal,
            },
          },
        },
      });
      await syncInvoiceBillingSources(tx, created.id, sourceIds);
      await audit(tx, {
        entityType: "INVOICE",
        entityId: created.id,
        action: "CREATE",
        actorId: access.current.id,
        after: {
          invoiceNumber: created.invoiceNumber,
          customerName: value.customerName,
          netAmount: created.netAmount.toString(),
          sourceIds,
        },
      });
      return created;
    });
    revalidatePath(financePath, "layout");
    return { data: row };
  } catch (error) {
    console.error("[CREATE_FINANCE_INVOICE_ENTRY]", error);
    if (error instanceof Error && error.message === "SOURCE_MISMATCH") {
      return {
        error:
          "Surat Jalan tidak tersedia atau berasal dari pelanggan yang berbeda",
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nomor invoice sudah digunakan" };
    }
    return { error: "Invoice gagal disimpan" };
  }
}

export async function updateFinanceInvoiceEntry(
  invoiceId: string,
  input: FinanceInvoiceEntryInput,
) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(invoiceId, 36);
  const parsed = parseInvoiceEntry(input);
  if (!id) return { error: "Invoice tidak valid" };
  if ("error" in parsed) return parsed;
  const value = parsed.data;

  try {
    const row = await prismadb.$transaction(async (tx) => {
      const existing = await tx.financeInvoice.findUnique({
        where: { id },
        include: { lines: { orderBy: { position: "asc" }, take: 1 } },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status === "PAID" || existing.status === "VOID") {
        throw new Error("LOCKED");
      }
      const counterparty = await tx.financeCounterparty.upsert({
        where: { normalizedName: value.normalizedName },
        create: {
          legalName: value.customerName,
          normalizedName: value.normalizedName,
          role: "CUSTOMER",
          isActive: true,
        },
        update: { isActive: true },
      });
      const sourceIds =
        value.sourceIds ??
        (
          await tx.financeBillingSource.findMany({
            where: { invoiceId: id },
            select: { id: true },
          })
        ).map((source) => source.id);
      await validateInvoiceBillingSources(tx, sourceIds, counterparty.id, id);
      const updated = await tx.financeInvoice.update({
        where: { id },
        data: {
          invoiceNumber: value.invoiceNumber,
          counterpartyId: counterparty.id,
          invoiceDate: value.invoiceDate,
          dueDate: value.dueDate,
          deliveryNoteNumber: value.deliveryNoteNumber,
          deliveryNoteDate: value.deliveryNoteDate,
          receiptNumber: value.receiptNumber,
          purchaseOrderNumber: value.purchaseOrderNumber,
          purchaseOrderDate: value.purchaseOrderDate,
          accountDestination: value.accountDestination,
          subtotal: value.subtotal,
          taxRate: value.taxRate,
          taxAmount: value.taxAmount,
          grossAmount: value.total,
          netAmount: value.total,
          taxInvoiceNumber: value.taxInvoiceNumber,
          notes: value.notes,
          lines: {
            deleteMany: {},
            create: {
              position: 1,
              kind: classifyFinanceRevenueLine({
                kind: "MANUAL",
                description: value.description,
              }),
              description: value.description,
              quantity: 1,
              unitPrice: value.subtotal,
              lineTotal: value.subtotal,
            },
          },
        },
      });
      await syncInvoiceBillingSources(tx, updated.id, sourceIds);
      await audit(tx, {
        entityType: "INVOICE",
        entityId: updated.id,
        action: "UPDATE",
        actorId: access.current.id,
        before: {
          invoiceNumber: existing.invoiceNumber,
          customerName: value.customerName,
          netAmount: existing.netAmount.toString(),
        },
        after: {
          invoiceNumber: updated.invoiceNumber,
          customerName: value.customerName,
          netAmount: updated.netAmount.toString(),
          sourceIds,
        },
      });
      return updated;
    });
    revalidatePath(financePath, "layout");
    return { data: row };
  } catch (error) {
    console.error("[UPDATE_FINANCE_INVOICE_ENTRY]", error);
    const reason = error instanceof Error ? error.message : "";
    if (reason === "NOT_FOUND") return { error: "Invoice tidak ditemukan" };
    if (reason === "LOCKED") return { error: "Invoice lunas atau void tidak dapat diedit" };
    if (reason === "SOURCE_MISMATCH") {
      return {
        error:
          "Surat Jalan tidak tersedia atau berasal dari pelanggan yang berbeda",
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Nomor invoice sudah digunakan" };
    }
    return { error: "Invoice gagal diperbarui" };
  }
}

export async function deleteFinanceInvoiceEntry(invoiceId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(invoiceId, 36);
  if (!id) return { error: "Invoice tidak valid" };

  try {
    await prismadb.$transaction(async (tx) => {
      const existing = await tx.financeInvoice.findUnique({
        where: { id },
        include: { _count: { select: { allocations: true } } },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing._count.allocations > 0) throw new Error("HAS_PAYMENT");
      await syncInvoiceBillingSources(tx, id, []);
      await tx.financeApproval.deleteMany({
        where: { entityType: "INVOICE", entityId: id },
      });
      await tx.financeInvoice.delete({ where: { id } });
      await audit(tx, {
        entityType: "INVOICE",
        entityId: id,
        action: "DELETE",
        actorId: access.current.id,
        before: {
          invoiceNumber: existing.invoiceNumber,
          netAmount: existing.netAmount.toString(),
        },
      });
    });
    revalidatePath(financePath, "layout");
    return { data: { id } };
  } catch (error) {
    console.error("[DELETE_FINANCE_INVOICE_ENTRY]", error);
    const reason = error instanceof Error ? error.message : "";
    if (reason === "NOT_FOUND") return { error: "Invoice tidak ditemukan" };
    if (reason === "HAS_PAYMENT") return { error: "Invoice yang sudah memiliki pembayaran tidak dapat dihapus" };
    return { error: "Invoice gagal dihapus" };
  }
}

export async function submitFinanceInvoiceForApproval(invoiceId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const invoice = await prismadb.financeInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status !== "DRAFT" || !invoice.dueDate || invoice.netAmount.lte(0)) {
    return { error: "Invoice draft belum lengkap" };
  }
  const approval = await prismadb.$transaction(async (tx) => {
    await tx.financeInvoice.update({
      where: { id: invoiceId, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", requestedBy: access.current.id },
    });
    const request = await tx.financeApproval.create({
      data: {
        action: "ISSUE_INVOICE",
        entityType: "INVOICE",
        entityId: invoiceId,
        requestedBy: access.current.id,
      },
    });
    await audit(tx, { entityType: "INVOICE", entityId: invoiceId, action: "REQUEST_APPROVAL", actorId: access.current.id });
    return request;
  });
  revalidatePath(financePath, "layout");
  return { data: approval };
}

export async function decideFinanceApproval(input: {
  approvalId: string;
  approve: boolean;
  reason?: string;
}) {
  const access = await ensureFinanceManager(true);
  if ("error" in access) return access;
  const reason = text(input.reason, 1000);

  try {
    const result = await prismadb.$transaction(async (tx) => {
      const request = await tx.financeApproval.findUnique({ where: { id: input.approvalId } });
      if (!request || request.status !== FinanceApprovalStatus.PENDING) throw new Error("APPROVAL_UNAVAILABLE");
      if (!canApproveFinanceRequest(request.requestedBy, access.current.id)) throw new Error("SELF_APPROVAL");
      const decidedAt = new Date();
      const status = input.approve ? FinanceApprovalStatus.APPROVED : FinanceApprovalStatus.REJECTED;

      if (request.action === FinanceApprovalAction.ISSUE_INVOICE) {
        const invoice = await tx.financeInvoice.findUnique({ where: { id: request.entityId } });
        if (!invoice || invoice.status !== FinanceInvoiceStatus.PENDING_APPROVAL || !invoice.dueDate) {
          throw new Error("INVOICE_UNAVAILABLE");
        }
        if (input.approve) {
          const invoiceNumber = await nextDocumentNumber(tx, "INV", decidedAt);
          const token = randomBytes(32).toString("base64url");
          await tx.financeInvoice.update({
            where: { id: invoice.id },
            data: {
              status: "ISSUED",
              invoiceNumber,
              invoiceDate: decidedAt,
              issuedAt: decidedAt,
              approvedBy: access.current.id,
              approvedAt: decidedAt,
              publicTokenHash: createHash("sha256").update(token).digest("hex"),
            },
          });
          await tx.financeBillingSource.updateMany({ where: { invoiceId: invoice.id }, data: { status: "BILLED" } });
        } else {
          await tx.financeInvoice.update({ where: { id: invoice.id }, data: { status: "DRAFT" } });
        }
      } else if (request.action === FinanceApprovalAction.APPROVE_QUOTE) {
        await tx.financeQuote.update({
          where: { id: request.entityId },
          data: input.approve
            ? { status: "APPROVED", approvedBy: access.current.id, approvedAt: decidedAt }
            : { status: "REJECTED" },
        });
      } else if (request.action === FinanceApprovalAction.POST_SUPPLIER_BILL) {
        await tx.financeSupplierBill.update({
          where: { id: request.entityId },
          data: input.approve
            ? { status: "POSTED", approvedBy: access.current.id, approvedAt: decidedAt, postedAt: decidedAt }
            : { status: "DRAFT" },
        });
      } else if (request.action === FinanceApprovalAction.POST_DISBURSEMENT) {
        if (!input.approve) {
          // No cash row exists until approval, so rejection only closes the request.
        } else {
          const metadata = request.metadata as Record<string, unknown> | null;
          const allocations = Array.isArray(metadata?.allocations) ? metadata.allocations as Array<{ supplierBillId: string; amount: string }> : [];
          const amount = new Prisma.Decimal(String(metadata?.amount ?? 0));
          const paidAt = new Date(String(metadata?.paidAt ?? ""));
          const counterpartyId = String(metadata?.counterpartyId ?? "");
          if (!counterpartyId || amount.lte(0) || Number.isNaN(paidAt.getTime()) || allocations.length === 0) throw new Error("DISBURSEMENT_INVALID");
          const bills = await tx.financeSupplierBill.findMany({ where: { id: { in: allocations.map((row) => row.supplierBillId) }, counterpartyId, status: { in: ["POSTED", "PARTIALLY_PAID"] } }, include: { allocations: { where: { disbursement: { status: "POSTED" } } } } });
          if (bills.length !== allocations.length) throw new Error("BILL_MISMATCH");
          for (const allocation of allocations) {
            const bill = bills.find((row) => row.id === allocation.supplierBillId)!;
            const paid = bill.allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
            if (new Prisma.Decimal(allocation.amount).gt(bill.totalAmount.sub(paid))) throw new Error("OVER_ALLOCATION");
          }
          const paymentNumber = await nextDocumentNumber(tx, "PAY", paidAt);
          const disbursement = await tx.financeDisbursement.create({ data: { paymentNumber, counterpartyId, method: String(metadata?.method ?? "BANK_TRANSFER") as FinancePaymentMethod, amount, paidAt, bankReference: text(metadata?.bankReference, 180) || null, notes: text(metadata?.notes, 1000) || null, createdBy: request.requestedBy, approvedBy: access.current.id, approvedAt: decidedAt, allocations: { create: allocations.map((row) => ({ supplierBillId: row.supplierBillId, amount: new Prisma.Decimal(row.amount) })) } } });
          for (const bill of bills) {
            const prior = bill.allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
            const added = allocations.find((row) => row.supplierBillId === bill.id);
            const nextPaid = prior.add(added?.amount ?? 0);
            await tx.financeSupplierBill.update({ where: { id: bill.id }, data: { status: nextPaid.gte(bill.totalAmount) ? "PAID" : "PARTIALLY_PAID" } });
          }
          await audit(tx, { entityType: "DISBURSEMENT", entityId: disbursement.id, action: "POST", actorId: access.current.id, metadata: { approvalId: request.id, paymentNumber } });
        }
      } else if (request.action === FinanceApprovalAction.OVERRIDE_SUPPLY_CONFLICT) {
        if (!input.approve || !reason) throw new Error("OVERRIDE_REASON_REQUIRED");
        await tx.logisticsPurchaseOrder.update({
          where: { id: request.entityId },
          data: { supplyReviewStatus: "OVERRIDDEN" },
        });
        await tx.logisticsSupplyAllocation.updateMany({
          where: { purchaseOrderItem: { purchaseOrderId: request.entityId } },
          data: { status: "OVERRIDDEN", overrideApprovalId: request.id },
        });
      }

      const approval = await tx.financeApproval.update({
        where: { id: request.id },
        data: { status, decidedBy: access.current.id, decidedAt, reason: reason || null },
      });
      await audit(tx, {
        entityType: request.entityType,
        entityId: request.entityId,
        action: input.approve ? "APPROVE" : "REJECT",
        actorId: access.current.id,
        metadata: { approvalId: request.id, approvalAction: request.action, reason },
      });
      return approval;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath(financePath, "layout");
    revalidatePath("/[locale]/(routes)/mektek/logistics", "page");
    return { data: result };
  } catch (error) {
    console.error("[DECIDE_FINANCE_APPROVAL]", error);
    return { error: error instanceof Error && error.message === "SELF_APPROVAL" ? "Pembuat tidak boleh menyetujui permintaannya sendiri" : "Approval tidak dapat diproses" };
  }
}

export async function postFinanceReceipt(input: {
  counterpartyId: string;
  method: FinancePaymentMethod;
  amount: string | number;
  receivedAt: string;
  bankReference?: string;
  providerPaymentId?: string;
  notes?: string;
  allocations: Array<{ invoiceId: string; amount: string | number }>;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const amount = money(input.amount);
  const receivedAt = dateOnly(input.receivedAt);
  const allocations = input.allocations.flatMap((allocation) => {
    const parsed = money(allocation.amount);
    return parsed && parsed.gt(0) ? [{ invoiceId: allocation.invoiceId, amount: parsed }] : [];
  });
  const allocated = allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
  if (!amount || amount.lte(0) || !receivedAt || allocated.gt(amount)) {
    return { error: "Jumlah, tanggal, atau alokasi pembayaran tidak valid" };
  }

  try {
    const receipt = await prismadb.$transaction(async (tx) => {
      const invoices = await tx.financeInvoice.findMany({
        where: { id: { in: allocations.map((row) => row.invoiceId) }, counterpartyId: input.counterpartyId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        include: { allocations: { where: { receipt: { status: "POSTED" } } } },
      });
      if (invoices.length !== allocations.length) throw new Error("INVOICE_MISMATCH");
      for (const allocation of allocations) {
        const invoice = invoices.find((row) => row.id === allocation.invoiceId)!;
        const paid = invoice.allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        if (allocation.amount.gt(invoice.netAmount.sub(paid))) throw new Error("OVER_ALLOCATION");
      }
      const receiptNumber = await nextDocumentNumber(tx, "RCPT", receivedAt);
      const created = await tx.financeReceipt.create({
        data: {
          receiptNumber,
          counterpartyId: input.counterpartyId,
          method: input.method,
          amount,
          receivedAt,
          bankReference: text(input.bankReference, 180) || null,
          providerPaymentId: text(input.providerPaymentId, 180) || null,
          proofRequired: input.method === "BANK_TRANSFER" || input.method === "OTHER",
          notes: text(input.notes, 1000) || null,
          createdBy: access.current.id,
          allocations: { create: allocations },
        },
      });
      for (const invoice of invoices) {
        const prior = invoice.allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        const added = allocations.find((row) => row.invoiceId === invoice.id)?.amount ?? new Prisma.Decimal(0);
        const nextPaid = prior.add(added);
        await tx.financeInvoice.update({
          where: { id: invoice.id },
          data: { status: nextPaid.gte(invoice.netAmount) ? "PAID" : "PARTIALLY_PAID" },
        });
      }
      await audit(tx, {
        entityType: "RECEIPT",
        entityId: created.id,
        action: "POST",
        actorId: access.current.id,
        after: { receiptNumber, amount: amount.toString(), allocations: allocations.map((row) => ({ invoiceId: row.invoiceId, amount: row.amount.toString() })) },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath(financePath, "layout");
    return { data: receipt };
  } catch (error) {
    console.error("[POST_FINANCE_RECEIPT]", error);
    return { error: "Pembayaran tidak cocok dengan invoice atau melebihi sisa tagihan" };
  }
}

export async function requestFinanceDisbursement(input: {
  counterpartyId: string;
  method: FinancePaymentMethod;
  amount: string | number;
  paidAt: string;
  bankReference?: string;
  notes?: string;
  allocations: Array<{ supplierBillId: string; amount: string | number }>;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const amount = money(input.amount);
  const paidAt = dateOnly(input.paidAt);
  const allocations = input.allocations.flatMap((row) => {
    const value = money(row.amount);
    return value && value.gt(0) ? [{ supplierBillId: text(row.supplierBillId, 36), amount: value.toString() }] : [];
  });
  const allocated = allocations.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
  if (!amount || amount.lte(0) || !paidAt || allocations.length === 0 || allocated.gt(amount)) return { error: "Jumlah, tanggal, dan alokasi pengeluaran tidak valid" };
  const request = await prismadb.$transaction(async (tx) => {
    const bills = await tx.financeSupplierBill.count({ where: { id: { in: allocations.map((row) => row.supplierBillId) }, counterpartyId: input.counterpartyId, status: { in: ["POSTED", "PARTIALLY_PAID"] } } });
    if (bills !== allocations.length) throw new Error("BILL_MISMATCH");
    const created = await tx.financeApproval.create({ data: { action: "POST_DISBURSEMENT", entityType: "DISBURSEMENT", entityId: crypto.randomUUID(), requestedBy: access.current.id, metadata: { counterpartyId: input.counterpartyId, method: input.method, amount: amount.toString(), paidAt: paidAt.toISOString(), bankReference: text(input.bankReference, 180), notes: text(input.notes, 1000), allocations } } });
    await audit(tx, { entityType: "DISBURSEMENT", entityId: created.entityId, action: "REQUEST_APPROVAL", actorId: access.current.id, metadata: { approvalId: created.id, amount: amount.toString() } });
    return created;
  });
  revalidatePath(financePath, "layout");
  return { data: request };
}

export async function createFinanceSupplierBill(input: {
  counterpartyId: string;
  supplierInvoiceNumber: string;
  billDate: string;
  dueDate: string;
  expenseCategory?: string;
  notes?: string;
  sourceIds?: string[];
  lines: Array<{ description: string; partNumber?: string; quantity: string | number; unitCost: string | number }>;
}) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const billDate = dateOnly(input.billDate);
  const dueDate = dateOnly(input.dueDate);
  const supplierInvoiceNumber = text(input.supplierInvoiceNumber, 180);
  const lines = input.lines.flatMap((line, index) => {
    const quantity = money(line.quantity);
    const unitCost = money(line.unitCost);
    const description = text(line.description, 500);
    if (!quantity || quantity.lte(0) || !unitCost || !description) return [];
    return [{ position: index + 1, description, partNumber: text(line.partNumber, 120) || null, quantity, unitCost, lineTotal: quantity.mul(unitCost) }];
  });
  if (!billDate || !dueDate || dueDate < billDate || !supplierInvoiceNumber || lines.length !== input.lines.length || lines.length === 0) {
    return { error: "Data supplier bill tidak lengkap" };
  }

  try {
    const bill = await prismadb.$transaction(async (tx) => {
      const internalNumber = await nextDocumentNumber(tx, "BILL", billDate);
      const total = lines.reduce((sum, row) => sum.add(row.lineTotal), new Prisma.Decimal(0));
      const sourceIds = [...new Set(input.sourceIds ?? [])];
      const sources = sourceIds.length
        ? await tx.financePayableSource.findMany({ where: { id: { in: sourceIds }, counterpartyId: input.counterpartyId, supplierBillId: null } })
        : [];
      if (sources.length !== sourceIds.length) throw new Error("SOURCE_MISMATCH");
      const expected = sources.reduce((sum, row) => sum.add(row.totalAmount ?? 0), new Prisma.Decimal(0));
      const created = await tx.financeSupplierBill.create({
        data: {
          internalNumber,
          supplierInvoiceNumber,
          counterpartyId: input.counterpartyId,
          billDate,
          dueDate,
          subtotal: total,
          totalAmount: total,
          expenseCategory: text(input.expenseCategory, 120) || null,
          matchException: sources.length && !expected.eq(total) ? `PO/Receiving ${expected.toString()} != Bill ${total.toString()}` : null,
          notes: text(input.notes, 1000) || null,
          requestedBy: access.current.id,
          lines: { create: lines },
        },
      });
      if (sourceIds.length) {
        await tx.financePayableSource.updateMany({ where: { id: { in: sourceIds } }, data: { supplierBillId: created.id, status: "DRAFTED" } });
      }
      await audit(tx, { entityType: "SUPPLIER_BILL", entityId: created.id, action: "CREATE_DRAFT", actorId: access.current.id, after: { internalNumber, total: total.toString(), sourceIds } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath(financePath, "layout");
    return { data: bill };
  } catch (error) {
    console.error("[CREATE_FINANCE_SUPPLIER_BILL]", error);
    return { error: "Supplier bill duplikat atau sumber tidak tersedia" };
  }
}

export async function submitFinanceSupplierBillForApproval(billId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const result = await prismadb.$transaction(async (tx) => {
    const bill = await tx.financeSupplierBill.update({
      where: { id: billId, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", requestedBy: access.current.id },
    });
    const request = await tx.financeApproval.create({
      data: { action: "POST_SUPPLIER_BILL", entityType: "SUPPLIER_BILL", entityId: bill.id, requestedBy: access.current.id },
    });
    await audit(tx, { entityType: "SUPPLIER_BILL", entityId: bill.id, action: "REQUEST_APPROVAL", actorId: access.current.id });
    return request;
  });
  revalidatePath(financePath, "layout");
  return { data: result };
}

export async function getFinanceOverview() {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const now = new Date();
  const [invoices, bills, receipts, disbursements, approvals, contracts, billingSources, payableSources] = await Promise.all([
    prismadb.financeInvoice.findMany({ where: { status: { not: "VOID" } }, select: { netAmount: true, dueDate: true, status: true, allocations: { where: { receipt: { status: "POSTED" } }, select: { amount: true } } } }),
    prismadb.financeSupplierBill.findMany({ where: { status: { not: "VOID" } }, select: { totalAmount: true, dueDate: true, status: true, allocations: { where: { disbursement: { status: "POSTED" } }, select: { amount: true } } } }),
    prismadb.financeReceipt.aggregate({ where: { status: "POSTED" }, _sum: { amount: true } }),
    prismadb.financeDisbursement.aggregate({ where: { status: "POSTED" }, _sum: { amount: true } }),
    prismadb.financeApproval.count({ where: { status: "PENDING" } }),
    prismadb.financeContract.count({ where: { status: "ACTIVE", endDate: { lte: new Date(now.getTime() + 30 * 86_400_000), gte: now } } }),
    prismadb.financeBillingSource.count({ where: { status: { in: [FinanceSourceStatus.UNBILLED, FinanceSourceStatus.NEEDS_REVIEW] } } }),
    prismadb.financePayableSource.count({ where: { status: { in: [FinanceSourceStatus.UNBILLED, FinanceSourceStatus.NEEDS_REVIEW] } } }),
  ]);
  const receivable = invoices.reduce((sum, invoice) => {
    const paid = invoice.allocations.reduce((value, row) => value + numberValue(row.amount), 0);
    return sum + Math.max(0, numberValue(invoice.netAmount) - paid);
  }, 0);
  const payable = bills.reduce((sum, bill) => {
    const paid = bill.allocations.reduce((value, row) => value + numberValue(row.amount), 0);
    return sum + Math.max(0, numberValue(bill.totalAmount) - paid);
  }, 0);
  const cashIn = numberValue(receipts._sum.amount);
  const cashOut = numberValue(disbursements._sum.amount);
  return {
    data: {
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
      receivable,
      payable,
      overdueReceivables: invoices.filter((row) => row.dueDate && row.dueDate < now && row.status !== "PAID").length,
      overduePayables: bills.filter((row) => row.dueDate < now && row.status !== "PAID").length,
      pendingApprovals: approvals,
      expiringContracts: contracts,
      unbilledSources: billingSources,
      unmatchedPayables: payableSources,
    },
  };
}
