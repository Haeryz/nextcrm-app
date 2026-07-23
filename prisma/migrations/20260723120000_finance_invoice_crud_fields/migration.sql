ALTER TABLE "FinanceInvoice"
ADD COLUMN "deliveryNoteNumber" TEXT,
ADD COLUMN "deliveryNoteDate" DATE,
ADD COLUMN "receiptNumber" TEXT,
ADD COLUMN "purchaseOrderNumber" TEXT,
ADD COLUMN "purchaseOrderDate" DATE,
ADD COLUMN "accountDestination" TEXT;
