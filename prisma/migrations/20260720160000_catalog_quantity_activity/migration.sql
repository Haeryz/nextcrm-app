ALTER TABLE "CatalogItem"
ADD COLUMN "previousQuantity" TEXT,
ADD COLUMN "quantityUpdatedAt" TIMESTAMP(3);

CREATE INDEX "CatalogItem_quantityUpdatedAt_idx"
ON "CatalogItem"("quantityUpdatedAt");
