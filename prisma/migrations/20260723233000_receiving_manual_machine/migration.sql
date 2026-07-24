ALTER TABLE "LogisticsPurchaseOrderItem"
  ADD COLUMN "machine" TEXT;

UPDATE "LogisticsPurchaseOrderItem" AS item
SET "machine" = catalog."machine"
FROM "CatalogItem" AS catalog
WHERE item."catalogItemId" = catalog."id";
