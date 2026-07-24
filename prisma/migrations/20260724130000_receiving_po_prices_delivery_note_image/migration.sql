ALTER TABLE "LogisticsPurchaseOrder"
ADD COLUMN "deliveryNoteImageData" BYTEA,
ADD COLUMN "deliveryNoteImageMimeType" TEXT,
ADD COLUMN "deliveryNoteImageUpdatedAt" TIMESTAMP(3);
