import "dotenv/config";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Prisma } from "@prisma/client";

import { normalizeFinanceKey } from "../lib/mektek/finance";
import { prismadb } from "../lib/prisma";

const LABEL = "accounting-workbook-demo-2026-07-23";
const DATA_FILE = ".tmp/accounting-demo-data.json";

type DemoInvoice = {
  sourceRow: number;
  customer: string;
  deliveryNoteNumber?: string | null;
  deliveryNoteDate?: string | null;
  receiptNumber?: string | null;
  invoiceNumber: string;
  invoiceDate?: string | null;
  purchaseOrderNumber?: string | null;
  purchaseOrderDate?: string | null;
  description: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxInvoiceNumber?: string | null;
  accountDestination?: string | null;
  category: string;
};

type DemoRow = {
  sheetKey: string;
  sourceRow: number;
  data: Prisma.InputJsonValue;
};

type ExtractedData = {
  sourceFileName: string;
  sourceSha256: string;
  counts: Record<string, number>;
  invoices: DemoInvoice[];
  rows: DemoRow[];
};

const parseDate = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const chunks = <T>(values: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

async function deleteDemoImport() {
  const existing = await prismadb.financeDemoImport.findUnique({
    where: { label: LABEL },
    select: { id: true },
  });
  if (!existing) return { deleted: false, reason: "not-found" };

  return prismadb.$transaction(async (tx) => {
    const deletedInvoices = await tx.financeInvoice.deleteMany({
      where: { demoImportId: existing.id },
    });
    const removableCounterparties = await tx.financeCounterparty.findMany({
      where: {
        demoImportId: existing.id,
        contracts: { none: {} },
        quotes: { none: {} },
        billingSources: { none: {} },
        invoices: { none: {} },
        receipts: { none: {} },
        payableSources: { none: {} },
        supplierBills: { none: {} },
        disbursements: { none: {} },
        purchaseOrders: { none: {} },
        supplyAllocations: { none: {} },
      },
      select: { id: true },
    });
    const deletedCounterparties = await tx.financeCounterparty.deleteMany({
      where: { id: { in: removableCounterparties.map((row) => row.id) } },
    });
    await tx.financeCounterparty.updateMany({
      where: { demoImportId: existing.id },
      data: { demoImportId: null },
    });
    const deletedBatch = await tx.financeDemoImport.delete({
      where: { id: existing.id },
      select: { rowCount: true },
    });
    return {
      deleted: true,
      invoices: deletedInvoices.count,
      counterparties: deletedCounterparties.count,
      workbookRows: deletedBatch.rowCount,
    };
  });
}

async function importDemo(data: ExtractedData) {
  const prior = await prismadb.financeDemoImport.findUnique({
    where: { label: LABEL },
    select: { id: true },
  });
  if (prior) {
    throw new Error(`Demo import ${LABEL} already exists. Delete it before importing again.`);
  }

  const batch = await prismadb.financeDemoImport.create({
    data: {
      label: LABEL,
      sourceFileName: data.sourceFileName,
      sourceSha256: data.sourceSha256,
      metadata: {
        counts: data.counts,
        invoiceCandidates: data.invoices.length,
      },
    },
    select: { id: true },
  });

  const existingCounterparties = await prismadb.financeCounterparty.findMany({
    select: { id: true, normalizedName: true },
  });
  const counterpartyIds = new Map(
    existingCounterparties.map((row) => [row.normalizedName, row.id]),
  );
  const missingCounterparties = new Map<string, { id: string; legalName: string }>();
  for (const invoice of data.invoices) {
    const normalizedName = normalizeFinanceKey(invoice.customer);
    if (!normalizedName || counterpartyIds.has(normalizedName) || missingCounterparties.has(normalizedName)) {
      continue;
    }
    missingCounterparties.set(normalizedName, {
      id: randomUUID(),
      legalName: invoice.customer,
    });
  }
  if (missingCounterparties.size) {
    await prismadb.financeCounterparty.createMany({
      data: [...missingCounterparties.entries()].map(([normalizedName, row]) => ({
        id: row.id,
        demoImportId: batch.id,
        legalName: row.legalName,
        normalizedName,
        role: "CUSTOMER",
        isActive: true,
      })),
    });
    for (const [normalizedName, row] of missingCounterparties) {
      counterpartyIds.set(normalizedName, row.id);
    }
  }

  const existingInvoices = new Set(
    (
      await prismadb.financeInvoice.findMany({
        where: { invoiceNumber: { in: data.invoices.map((row) => row.invoiceNumber) } },
        select: { invoiceNumber: true },
      })
    ).flatMap((row) => row.invoiceNumber ? [row.invoiceNumber] : []),
  );
  const invoices: Prisma.FinanceInvoiceCreateManyInput[] = [];
  const lines: Prisma.FinanceInvoiceLineCreateManyInput[] = [];
  for (const input of data.invoices) {
    if (existingInvoices.has(input.invoiceNumber)) continue;
    const counterpartyId = counterpartyIds.get(normalizeFinanceKey(input.customer));
    if (!counterpartyId) continue;
    const invoiceId = randomUUID();
    const subtotal = Math.max(0, input.subtotal || 0);
    const taxAmount = Math.max(0, input.taxAmount || 0);
    const total = Math.max(0, input.total || subtotal + taxAmount);
    const taxRate = subtotal > 0 ? Math.min(1, taxAmount / subtotal) : 0;
    const invoiceDate = parseDate(input.invoiceDate);
    invoices.push({
      id: invoiceId,
      draftNumber: randomUUID(),
      demoImportId: batch.id,
      invoiceNumber: input.invoiceNumber,
      counterpartyId,
      status: "ISSUED",
      currency: "IDR",
      invoiceDate,
      deliveryNoteNumber: input.deliveryNoteNumber || null,
      deliveryNoteDate: parseDate(input.deliveryNoteDate),
      receiptNumber: input.receiptNumber || null,
      purchaseOrderNumber: input.purchaseOrderNumber || null,
      purchaseOrderDate: parseDate(input.purchaseOrderDate),
      accountDestination: input.accountDestination || null,
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      discountAmount: new Prisma.Decimal(0),
      taxRate: new Prisma.Decimal(taxRate.toFixed(6)),
      taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
      withholdingRate: new Prisma.Decimal(0),
      withholdingAmount: new Prisma.Decimal(0),
      grossAmount: new Prisma.Decimal(total.toFixed(2)),
      netAmount: new Prisma.Decimal(total.toFixed(2)),
      taxInvoiceNumber: input.taxInvoiceNumber || null,
      notes: `Data demo dari ${data.sourceFileName}, baris ${input.sourceRow}`,
      issuedAt: invoiceDate ?? new Date(),
    });
    lines.push({
      id: randomUUID(),
      invoiceId,
      position: 1,
      kind: input.category,
      description: input.description,
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(subtotal.toFixed(2)),
      discountAmount: new Prisma.Decimal(0),
      lineTotal: new Prisma.Decimal(subtotal.toFixed(2)),
      sourceLineKey: `demo:${batch.id}:${input.sourceRow}`,
    });
  }

  for (const group of chunks(invoices, 300)) {
    await prismadb.financeInvoice.createMany({ data: group });
  }
  for (const group of chunks(lines, 500)) {
    await prismadb.financeInvoiceLine.createMany({ data: group });
  }
  for (const group of chunks(data.rows, 500)) {
    await prismadb.financeDemoRow.createMany({
      data: group.map((row) => ({
        importId: batch.id,
        sheetKey: row.sheetKey,
        sourceRow: row.sourceRow,
        data: row.data,
      })),
    });
  }
  await prismadb.financeDemoImport.update({
    where: { id: batch.id },
    data: { rowCount: data.rows.length },
  });

  return {
    importId: batch.id,
    rows: data.rows.length,
    invoices: invoices.length,
    counterparties: missingCounterparties.size,
    skippedExistingInvoices: data.invoices.length - invoices.length,
  };
}

async function main() {
  const commit = process.argv.includes("--commit");
  const deleting = process.argv.includes("--delete");
  if (!commit) {
    if (deleting) {
      const existing = await prismadb.financeDemoImport.findUnique({
        where: { label: LABEL },
        select: {
          id: true,
          rowCount: true,
          _count: { select: { invoices: true, counterparties: true } },
        },
      });
      console.log(JSON.stringify({
        mode: "dry-run",
        action: "delete",
        label: LABEL,
        existing,
      }, null, 2));
      return;
    }
    const data = JSON.parse(await readFile(DATA_FILE, "utf8")) as ExtractedData;
    console.log(JSON.stringify({
      mode: "dry-run",
      action: deleting ? "delete" : "import",
      label: LABEL,
      rows: data.rows.length,
      invoices: data.invoices.length,
      counts: data.counts,
    }, null, 2));
    return;
  }
  const result = deleting
    ? await deleteDemoImport()
    : await importDemo(JSON.parse(await readFile(DATA_FILE, "utf8")) as ExtractedData);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .finally(() => prismadb.$disconnect());
