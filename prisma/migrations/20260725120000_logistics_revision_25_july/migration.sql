-- Receiving: signed photo of Mektek-made Surat Jalan (#2)
ALTER TABLE "LogisticsPurchaseOrder"
  ADD COLUMN IF NOT EXISTS "mektekDeliveryNoteImageData" BYTEA,
  ADD COLUMN IF NOT EXISTS "mektekDeliveryNoteImageMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "mektekDeliveryNoteImageUpdatedAt" TIMESTAMP(3);

-- Monitoring PO: mandatory upload of customer PO PDF/Image (#14)
ALTER TABLE "LogisticsPurchaseOrder"
  ADD COLUMN IF NOT EXISTS "customerPoImageData" BYTEA,
  ADD COLUMN IF NOT EXISTS "customerPoImageMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPoImageUpdatedAt" TIMESTAMP(3);

-- Catat Mutasi Stok: counterparty (from/to party) column (#18)
ALTER TABLE "CatalogStockMovement"
  ADD COLUMN IF NOT EXISTS "counterpartyName" TEXT;

-- Consignment site stock tracking (#10)
-- Drop any partial table from the first failed run (id was TEXT, must be UUID).
DROP INDEX IF EXISTS "CatalogStockMovement_consignmentSiteId_idx";
DROP INDEX IF EXISTS "CatalogConsignmentSite_catalogItemId_siteName_key";
DROP INDEX IF EXISTS "CatalogConsignmentSite_catalogItemId_idx";
DROP INDEX IF EXISTS "CatalogConsignmentSite_siteName_idx";
DROP INDEX IF EXISTS "CatalogConsignmentSite_projectKey_idx";
ALTER TABLE "CatalogStockMovement" DROP CONSTRAINT IF EXISTS "CatalogStockMovement_consignmentSiteId_fkey";
ALTER TABLE "CatalogStockMovement" DROP COLUMN IF EXISTS "consignmentSiteId";
ALTER TABLE "CatalogConsignmentSite" DROP CONSTRAINT IF EXISTS "CatalogConsignmentSite_catalogItemId_fkey";
DROP TABLE IF EXISTS "CatalogConsignmentSite";

CREATE TABLE "CatalogConsignmentSite" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "catalogItemId" TEXT NOT NULL,
  "siteName" TEXT NOT NULL,
  "projectKey" TEXT,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogConsignmentSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogConsignmentSite_catalogItemId_siteName_key"
  ON "CatalogConsignmentSite"("catalogItemId", "siteName");

CREATE INDEX "CatalogConsignmentSite_catalogItemId_idx"
  ON "CatalogConsignmentSite"("catalogItemId");

CREATE INDEX "CatalogConsignmentSite_siteName_idx"
  ON "CatalogConsignmentSite"("siteName");

CREATE INDEX "CatalogConsignmentSite_projectKey_idx"
  ON "CatalogConsignmentSite"("projectKey");

ALTER TABLE "CatalogConsignmentSite"
  ADD CONSTRAINT "CatalogConsignmentSite_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogStockMovement"
  ADD COLUMN "consignmentSiteId" UUID;

ALTER TABLE "CatalogStockMovement"
  ADD CONSTRAINT "CatalogStockMovement_consignmentSiteId_fkey"
  FOREIGN KEY ("consignmentSiteId") REFERENCES "CatalogConsignmentSite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CatalogStockMovement_consignmentSiteId_idx"
  ON "CatalogStockMovement"("consignmentSiteId");
