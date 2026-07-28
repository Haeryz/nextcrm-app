-- AlterTable
ALTER TABLE "MektekSupplierDebtTransaction" ADD COLUMN "proofImageData" BYTEA,
ADD COLUMN "proofImageMimeType" TEXT,
ADD COLUMN "proofImageUpdatedAt" TIMESTAMP(3);
