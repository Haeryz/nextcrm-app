import "dotenv/config";

import { prismadb } from "../lib/prisma";

// Submenu Akuntansi only. Keuangan (Pembayaran Pemasok, Hutang Pemasok) and
// source data from other features (LogisticsPurchaseOrder, MektekPayment,
// crm_Accounts_Tasks) are NOT touched. FinanceCounterparty is preserved as
// shared reference data. Shared audit/approval/attachment/sequence tables are
// filtered to accounting entity types / document kinds only.
const ACCOUNTING_ENTITY_TYPES = ["CONTRACT", "QUOTE", "INVOICE", "RECEIPT"] as const;
const ACCOUNTING_SEQUENCE_KINDS = ["INV", "RCPT", "QUO"] as const;

type Count = { model: string; count: number };

async function preview(): Promise<Count[]> {
  const whereShared = {
    entityType: { in: [...ACCOUNTING_ENTITY_TYPES] },
  };
  const whereSequence = {
    kind: { in: [...ACCOUNTING_SEQUENCE_KINDS] },
  };

  const [
    financeReceiptAllocation,
    financeBillingSource,
    financeReceipt,
    financeInvoice,
    financeContract,
    financeQuote,
    paymentFakturEntry,
    paymentFakturCustomer,
    financeDemoImport,
    financeAttachment,
    financeAuditEvent,
    financeApproval,
    financeDocumentSequence,
  ] = await Promise.all([
    prismadb.financeReceiptAllocation.count(),
    prismadb.financeBillingSource.count(),
    prismadb.financeReceipt.count(),
    prismadb.financeInvoice.count(),
    prismadb.financeContract.count(),
    prismadb.financeQuote.count(),
    prismadb.paymentFakturEntry.count(),
    prismadb.paymentFakturCustomer.count(),
    prismadb.financeDemoImport.count(),
    prismadb.financeAttachment.count({ where: whereShared }),
    prismadb.financeAuditEvent.count({ where: whereShared }),
    prismadb.financeApproval.count({ where: whereShared }),
    prismadb.financeDocumentSequence.count({ where: whereSequence }),
  ]);

  return [
    { model: "financeReceiptAllocation", count: financeReceiptAllocation },
    { model: "financeBillingSource", count: financeBillingSource },
    { model: "financeReceipt", count: financeReceipt },
    { model: "financeInvoice", count: financeInvoice },
    { model: "financeContract", count: financeContract },
    { model: "financeQuote", count: financeQuote },
    { model: "paymentFakturEntry", count: paymentFakturEntry },
    { model: "paymentFakturCustomer", count: paymentFakturCustomer },
    { model: "financeDemoImport", count: financeDemoImport },
    { model: "financeAttachment", count: financeAttachment },
    { model: "financeAuditEvent", count: financeAuditEvent },
    { model: "financeApproval", count: financeApproval },
    { model: "financeDocumentSequence", count: financeDocumentSequence },
  ];
}

async function wipe() {
  const whereShared = {
    entityType: { in: [...ACCOUNTING_ENTITY_TYPES] },
  };
  const whereSequence = {
    kind: { in: [...ACCOUNTING_SEQUENCE_KINDS] },
  };

  return prismadb.$transaction(async (tx) => {
    // FK-safe order: allocations before invoices (Restrict), billing sources
    // before invoices/contracts (SetNull), payment faktur entries before
    // customers (Restrict). Lines/rows/reminders cascade from their parents.
    const financeReceiptAllocation = await tx.financeReceiptAllocation.deleteMany({});
    const financeBillingSource = await tx.financeBillingSource.deleteMany({});
    const financeReceipt = await tx.financeReceipt.deleteMany({});
    const financeInvoice = await tx.financeInvoice.deleteMany({});
    const financeContract = await tx.financeContract.deleteMany({});
    const financeQuote = await tx.financeQuote.deleteMany({});
    const paymentFakturEntry = await tx.paymentFakturEntry.deleteMany({});
    const paymentFakturCustomer = await tx.paymentFakturCustomer.deleteMany({});
    const financeDemoImport = await tx.financeDemoImport.deleteMany({});
    const financeAttachment = await tx.financeAttachment.deleteMany({ where: whereShared });
    const financeAuditEvent = await tx.financeAuditEvent.deleteMany({ where: whereShared });
    const financeApproval = await tx.financeApproval.deleteMany({ where: whereShared });
    const financeDocumentSequence = await tx.financeDocumentSequence.deleteMany({ where: whereSequence });

    return {
      financeReceiptAllocation: financeReceiptAllocation.count,
      financeBillingSource: financeBillingSource.count,
      financeReceipt: financeReceipt.count,
      financeInvoice: financeInvoice.count,
      financeContract: financeContract.count,
      financeQuote: financeQuote.count,
      paymentFakturEntry: paymentFakturEntry.count,
      paymentFakturCustomer: paymentFakturCustomer.count,
      financeDemoImport: financeDemoImport.count,
      financeAttachment: financeAttachment.count,
      financeAuditEvent: financeAuditEvent.count,
      financeApproval: financeApproval.count,
      financeDocumentSequence: financeDocumentSequence.count,
    };
  });
}

async function main() {
  const commit = process.argv.includes("--commit");

  if (!commit) {
    const willDelete = await preview();
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          action: "wipe-accounting-data",
          note: "Jalankan dengan --commit untuk benar-benar menghapus. Buat backup dulu.",
          willDelete,
          preserved: {
            financeCounterparty: "tidak dihapus (data referensi berbagi)",
            keuangan: "FinanceSupplierBill, FinanceDisbursement, FinancePayableSource, MektekSupplierDebt*",
            sourceData: "LogisticsPurchaseOrder, MektekPayment, crm_Accounts_Tasks",
            sharedFiltered: "audit/approval/attachment/sequence Keuangan tetap utuh",
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const deleted = await wipe();

  const preserved = await Promise.all([
    prismadb.financeCounterparty.count(),
    prismadb.financeSupplierBill.count(),
    prismadb.financeDisbursement.count(),
    prismadb.mektekSupplierDebtEntry.count(),
    prismadb.logisticsPurchaseOrder.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        mode: "commit",
        action: "wipe-accounting-data",
        deleted,
        preserved: {
          financeCounterparty: preserved[0],
          financeSupplierBill: preserved[1],
          financeDisbursement: preserved[2],
          mektekSupplierDebtEntry: preserved[3],
          logisticsPurchaseOrder: preserved[4],
        },
      },
      null,
      2,
    ),
  );
}

main().finally(() => prismadb.$disconnect());
