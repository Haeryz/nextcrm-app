ALTER TABLE "LogisticsPurchaseOrder"
  ADD COLUMN IF NOT EXISTS "signedPoImageData" BYTEA,
  ADD COLUMN IF NOT EXISTS "signedPoImageMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "signedPoImageUpdatedAt" TIMESTAMP(3);
