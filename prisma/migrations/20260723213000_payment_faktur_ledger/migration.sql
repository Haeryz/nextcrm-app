CREATE TABLE "PaymentFakturCustomer" (
    "id" UUID NOT NULL,
    "sheetKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "taxLabelPercent" DECIMAL(5,2) NOT NULL DEFAULT 11,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentFakturCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentFakturEntry" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "sourceRow" INTEGER,
    "receiptNumber" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE,
    "purchaseOrderNumber" TEXT,
    "deliveryDate" DATE,
    "description" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transferDate" DATE,
    "taxInvoiceNumber" TEXT,
    "installment1" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "installment2" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "installment3" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentFakturEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentFakturCustomer_sheetKey_key"
ON "PaymentFakturCustomer"("sheetKey");
CREATE INDEX "PaymentFakturCustomer_position_idx"
ON "PaymentFakturCustomer"("position");
CREATE INDEX "PaymentFakturCustomer_customerName_idx"
ON "PaymentFakturCustomer"("customerName");
CREATE UNIQUE INDEX "PaymentFakturEntry_customerId_sourceRow_key"
ON "PaymentFakturEntry"("customerId", "sourceRow");
CREATE INDEX "PaymentFakturEntry_customerId_invoiceDate_idx"
ON "PaymentFakturEntry"("customerId", "invoiceDate");
CREATE INDEX "PaymentFakturEntry_invoiceNumber_idx"
ON "PaymentFakturEntry"("invoiceNumber");
CREATE INDEX "PaymentFakturEntry_transferDate_idx"
ON "PaymentFakturEntry"("transferDate");
CREATE INDEX "PaymentFakturEntry_purchaseOrderNumber_idx"
ON "PaymentFakturEntry"("purchaseOrderNumber");

ALTER TABLE "PaymentFakturEntry"
ADD CONSTRAINT "PaymentFakturEntry_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "PaymentFakturCustomer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
