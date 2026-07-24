CREATE TABLE "MektekSupplierDebtEntry" (
    "id" UUID NOT NULL,
    "sheetKey" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "number" TEXT,
    "purchaseOrderDate" DATE,
    "purchaseOrderNumber" TEXT,
    "goodsReceiptDate" DATE,
    "receivedBy" TEXT,
    "deliveryNoteNumber" TEXT,
    "invoiceDate" DATE,
    "invoiceNumber" TEXT,
    "taxInvoiceNumber" TEXT,
    "dueDate" DATE,
    "partNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "partsEntryDate" DATE,
    "paymentDate" DATE,
    "paymentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pbkDate" DATE,
    "accountCode" TEXT,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekSupplierDebtEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MektekSupplierDebtEntry_sheetKey_sourceRow_key"
ON "MektekSupplierDebtEntry"("sheetKey", "sourceRow");

CREATE INDEX "MektekSupplierDebtEntry_sheetKey_invoiceDate_idx"
ON "MektekSupplierDebtEntry"("sheetKey", "invoiceDate");

CREATE INDEX "MektekSupplierDebtEntry_purchaseOrderNumber_idx"
ON "MektekSupplierDebtEntry"("purchaseOrderNumber");

CREATE INDEX "MektekSupplierDebtEntry_deliveryNoteNumber_idx"
ON "MektekSupplierDebtEntry"("deliveryNoteNumber");

CREATE INDEX "MektekSupplierDebtEntry_invoiceNumber_idx"
ON "MektekSupplierDebtEntry"("invoiceNumber");
