import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import { extractPaymentFakturWorkbook } from "../lib/mektek/payment-faktur";
import { prismadb } from "../lib/prisma";

const workbookPath = resolve("data", "PAYMENT FAKTUR 2026.xlsx");
const commit = process.argv.includes("--commit");

async function main() {
  const workbookBuffer = readFileSync(workbookPath);
  const sourceSha256 = createHash("sha256")
    .update(workbookBuffer)
    .digest("hex");
  const workbook = XLSX.read(workbookBuffer, {
    type: "buffer",
    cellDates: true,
    cellFormula: true,
  });
  const extracted = extractPaymentFakturWorkbook(workbook);

  if (!commit) {
    console.log({
      mode: "dry-run",
      sourceSha256,
      customers: extracted.customers.length,
      entries: extracted.entries.length,
    });
    return;
  }

  const customerIds = new Map<string, string>();
  for (const customer of extracted.customers) {
    const saved = await prismadb.paymentFakturCustomer.upsert({
      where: { sheetKey: customer.sheetKey },
      create: customer,
      update: {
        customerName: customer.customerName,
        position: customer.position,
        taxLabelPercent: customer.taxLabelPercent,
      },
      select: { id: true },
    });
    customerIds.set(customer.sheetKey, saved.id);
  }

  const data: Prisma.PaymentFakturEntryCreateManyInput[] =
    extracted.entries.map((entry) => ({
      customerId: customerIds.get(entry.sheetKey)!,
      sourceRow: entry.sourceRow,
      receiptNumber: entry.receiptNumber,
      invoiceNumber: entry.invoiceNumber,
      invoiceDate: entry.invoiceDate,
      purchaseOrderNumber: entry.purchaseOrderNumber,
      deliveryDate: entry.deliveryDate,
      description: entry.description,
      subtotal: new Prisma.Decimal(entry.subtotal.toFixed(2)),
      taxAmount: new Prisma.Decimal(entry.taxAmount.toFixed(2)),
      grandTotal: new Prisma.Decimal(entry.grandTotal.toFixed(2)),
      transferDate: entry.transferDate,
      taxInvoiceNumber: entry.taxInvoiceNumber,
      installment1: new Prisma.Decimal(entry.installment1.toFixed(2)),
      installment2: new Prisma.Decimal(entry.installment2.toFixed(2)),
      installment3: new Prisma.Decimal(entry.installment3.toFixed(2)),
    }));

  let inserted = 0;
  for (let index = 0; index < data.length; index += 300) {
    const result = await prismadb.paymentFakturEntry.createMany({
      data: data.slice(index, index + 300),
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  console.log({
    mode: "committed",
    sourceSha256,
    customers: customerIds.size,
    workbookEntries: data.length,
    inserted,
    skippedExisting: data.length - inserted,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismadb.$disconnect();
  });
