import "dotenv/config";

import { FinancePaymentMethod, Prisma } from "@prisma/client";

import { prismadb } from "../lib/prisma";

const TARGET_INVOICE_NUMBER = "MTL0708261";
const TARGET_SHEET_KEY = "VARIASI AC";
const commit = process.argv.includes("--commit");

const paidAtArgument = process.argv.find((argument) =>
  argument.startsWith("--paid-at="),
);
const methodArgument = process.argv.find((argument) =>
  argument.startsWith("--method="),
);
const referenceArgument = process.argv.find((argument) =>
  argument.startsWith("--reference="),
);

const usage =
  "Penggunaan: pnpm exec tsx scripts/repair-variation-asun-payable.ts " +
  "--paid-at=YYYY-MM-DD [--method=BANK_TRANSFER] [--reference=REFERENSI] [--commit]";

const parseDateOnly = (value: string | undefined) => {
  const raw = value?.split("=", 2)[1] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeName = (value: string) =>
  value.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, "");

const readArgument = (value: string | undefined) =>
  value?.split("=", 2)[1]?.trim() ?? "";

const parsePaymentMethod = (value: string | undefined) => {
  const candidate = readArgument(value).toUpperCase();
  return Object.values(FinancePaymentMethod).includes(
    candidate as FinancePaymentMethod,
  )
    ? (candidate as FinancePaymentMethod)
    : null;
};

const jsonString = (value: Prisma.JsonValue, key: string) => {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const candidate = (value as Prisma.JsonObject)[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
};

async function main() {
  const paidAt = parseDateOnly(paidAtArgument);
  if (!paidAt) throw new Error(usage);
  const method = parsePaymentMethod(methodArgument);
  const bankReference = readArgument(referenceArgument).slice(0, 180);
  if (commit && (!method || !bankReference)) {
    throw new Error(
      `Mode --commit mewajibkan --method dan --reference. ${usage}`,
    );
  }

  const candidates = await prismadb.financeSupplierBill.findMany({
    where: { supplierInvoiceNumber: "MTL0708261" },
    include: {
      counterparty: { select: { legalName: true } },
      sources: { orderBy: { occurredAt: "asc" } },
      allocations: {
        where: { disbursement: { status: "POSTED" } },
        select: { amount: true },
      },
    },
  });
  const bills = candidates.filter((candidate) => {
    const name = normalizeName(candidate.counterparty.legalName);
    return name.includes("variasiac") && name.includes("asun");
  });
  if (bills.length !== 1) {
    throw new Error(
      `Target harus tepat satu tagihan, ditemukan ${bills.length} untuk ${TARGET_INVOICE_NUMBER}`,
    );
  }

  const bill = bills[0];
  if (paidAt < bill.billDate) {
    throw new Error("Tanggal pembayaran tidak boleh sebelum tanggal invoice");
  }
  const alreadyAllocated = bill.allocations.reduce(
    (total, allocation) => total.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  if (alreadyAllocated.gt(0) && alreadyAllocated.lt(bill.totalAmount)) {
    throw new Error(
      "Tagihan sudah dibayar sebagian. Catat sisa pembayaran dari halaman Pembayaran Pemasok.",
    );
  }
  const createPayment = alreadyAllocated.eq(0);
  const source = bill.sources[0] ?? null;
  const poNumber = source ? jsonString(source.snapshot, "poNumber") : null;
  const purchaseOrderId = source
    ? jsonString(source.snapshot, "purchaseOrderId")
    : null;
  const receivingPics = purchaseOrderId
    ? await prismadb.logisticsReceipt.findMany({
        where: { purchaseOrderItem: { purchaseOrderId } },
        select: { picId: true, pic: { select: { name: true } } },
        distinct: ["picId"],
      })
    : [];
  const receivedBy =
    receivingPics.map((row) => row.pic.name).filter(Boolean).join(", ") || null;

  const existingInvoiceRows = await prismadb.mektekSupplierDebtEntry.findMany({
    where: { invoiceNumber: TARGET_INVOICE_NUMBER },
    select: { id: true, sheetKey: true, sourceRow: true },
  });
  const foreignRows = existingInvoiceRows.filter(
    (row) => row.sheetKey !== TARGET_SHEET_KEY,
  );
  if (foreignRows.length) {
    throw new Error(
      `Invoice sudah ada pada sheet lain: ${foreignRows
        .map((row) => `${row.sheetKey}:${row.sourceRow}`)
        .join(", ")}`,
    );
  }

  const existing = existingInvoiceRows[0] ?? null;
  const lastManualRow = existing
    ? null
    : await prismadb.mektekSupplierDebtEntry.findFirst({
        where: { sheetKey: TARGET_SHEET_KEY, sourceRow: { gte: 1_000_001 } },
        orderBy: { sourceRow: "desc" },
        select: { sourceRow: true },
      });
  const sourceRow =
    existing?.sourceRow ?? Math.max(1_000_001, (lastManualRow?.sourceRow ?? 1_000_000) + 1);
  const entryData = {
    number: String(sourceRow - 1_000_000),
    purchaseOrderDate: source?.occurredAt ?? bill.billDate,
    purchaseOrderNumber: poNumber,
    goodsReceiptDate: source?.occurredAt ?? null,
    receivedBy,
    deliveryNoteNumber: source?.sourceReference ?? null,
    invoiceDate: bill.billDate,
    invoiceNumber: bill.supplierInvoiceNumber,
    dueDate: bill.billDate,
    description: `Invoice ${bill.supplierInvoiceNumber}${
      poNumber ? ` — ${poNumber}` : ""
    }`,
    quantity: new Prisma.Decimal(1),
    unitPrice: bill.subtotal,
    amount: bill.subtotal,
    ppnAmount: bill.taxAmount,
    grandTotal: bill.totalAmount,
    paymentDate: paidAt,
    paymentAmount: bill.totalAmount,
    updatedBy: bill.requestedBy,
  };

  const preview = {
    mode: commit ? "COMMIT" : "DRY_RUN",
    billId: bill.id,
    internalNumber: bill.internalNumber,
    supplier: bill.counterparty.legalName,
    invoiceNumber: bill.supplierInvoiceNumber,
    priorDueDate: bill.dueDate.toISOString().slice(0, 10),
    nextDueDate: bill.billDate.toISOString().slice(0, 10),
    paidAt: paidAt.toISOString().slice(0, 10),
    method,
    bankReference: bankReference || null,
    amount: bill.totalAmount.toString(),
    debtEntry: `${TARGET_SHEET_KEY}:${sourceRow}`,
    operation: existing ? "update" : "recreate",
    paymentOperation: createPayment ? "create" : "already-posted",
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!commit) {
    console.log("DRY RUN: tambahkan --commit setelah hasil di atas diverifikasi.");
    return;
  }

  await prismadb.$transaction(async (transaction) => {
    const paymentNumber = `PAY-REPAIR-${bill.internalNumber}`;
    if (createPayment) {
      await transaction.financeDisbursement.create({
        data: {
          paymentNumber,
          counterpartyId: bill.counterpartyId,
          method: method!,
          amount: bill.totalAmount,
          paidAt,
          bankReference,
          notes: "Rekonsiliasi pembayaran VARIASI AC / ASUN",
          createdBy: bill.requestedBy,
          allocations: {
            create: {
              supplierBillId: bill.id,
              amount: bill.totalAmount,
            },
          },
        },
      });
    }
    await transaction.financeSupplierBill.update({
      where: { id: bill.id },
      data: {
        dueDate: bill.billDate,
        status: "PAID",
        postedAt: bill.postedAt ?? new Date(),
      },
    });
    await transaction.mektekSupplierDebtEntry.upsert({
      where: { sheetKey_sourceRow: { sheetKey: TARGET_SHEET_KEY, sourceRow } },
      update: entryData,
      create: {
        sheetKey: TARGET_SHEET_KEY,
        sourceRow,
        ...entryData,
        createdBy: bill.requestedBy,
      },
    });
    await transaction.financeAuditEvent.create({
      data: {
        entityType: "SUPPLIER_BILL",
        entityId: bill.id,
        action: "REPAIR_SUPPLIER_DEBT_AND_PAYMENT",
        actorId: bill.requestedBy,
        metadata: preview,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log("Perbaikan VARIASI AC / ASUN berhasil disimpan.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismadb.$disconnect();
  });
