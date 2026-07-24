ALTER TABLE "LogisticsPurchaseOrder"
ADD COLUMN "supplierInvoiceImageData" BYTEA,
ADD COLUMN "supplierInvoiceImageMimeType" TEXT,
ADD COLUMN "supplierInvoiceImageUpdatedAt" TIMESTAMP(3);
