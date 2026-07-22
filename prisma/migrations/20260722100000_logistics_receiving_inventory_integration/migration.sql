CREATE TYPE "CatalogStockMovementSource" AS ENUM (
  'MANUAL',
  'RECEIVING',
  'OUTBOUND_PO'
);

CREATE TYPE "LogisticsPurchaseOrderFlow" AS ENUM (
  'RECEIVING',
  'OUTBOUND'
);

ALTER TABLE "CatalogStockMovement"
  ADD COLUMN "source" "CatalogStockMovementSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceId" TEXT;

ALTER TABLE "LogisticsPurchaseOrder"
  ADD COLUMN "flow" "LogisticsPurchaseOrderFlow" NOT NULL DEFAULT 'RECEIVING',
  ADD COLUMN "deliveryNoteNumber" TEXT,
  ADD COLUMN "deliveryDate" DATE;

ALTER TABLE "LogisticsPurchaseOrderItem"
  ADD COLUMN "catalogItemId" TEXT,
  ADD COLUMN "warehouse" "CatalogWarehouse",
  ADD COLUMN "note" TEXT;

ALTER TABLE "LogisticsReceipt"
  ADD COLUMN "warehouse" "CatalogWarehouse" NOT NULL DEFAULT 'REAR';

ALTER TABLE "LogisticsReceipt"
  RENAME COLUMN "deliveryNoteNumber" TO "receivingReference";

ALTER INDEX "LogisticsReceipt_purchaseOrderItemId_deliveryNoteNumber_key"
  RENAME TO "LogisticsReceipt_purchaseOrderItemId_receivingReference_key";

ALTER INDEX "LogisticsReceipt_deliveryNoteNumber_idx"
  RENAME TO "LogisticsReceipt_receivingReference_idx";

DROP INDEX "LogisticsPurchaseOrder_poNumber_key";

CREATE UNIQUE INDEX "LogisticsPurchaseOrder_flow_poNumber_key"
  ON "LogisticsPurchaseOrder"("flow", "poNumber");

CREATE UNIQUE INDEX "LogisticsPurchaseOrder_deliveryNoteNumber_key"
  ON "LogisticsPurchaseOrder"("deliveryNoteNumber");

CREATE INDEX "LogisticsPurchaseOrder_flow_status_dueDate_idx"
  ON "LogisticsPurchaseOrder"("flow", "status", "dueDate");

DROP INDEX "LogisticsPurchaseOrder_status_dueDate_idx";

CREATE INDEX "LogisticsPurchaseOrderItem_catalogItemId_idx"
  ON "LogisticsPurchaseOrderItem"("catalogItemId");

CREATE UNIQUE INDEX "CatalogStockMovement_source_sourceId_key"
  ON "CatalogStockMovement"("source", "sourceId");

ALTER TABLE "LogisticsPurchaseOrderItem"
  ADD CONSTRAINT "LogisticsPurchaseOrderItem_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Best-effort linkage for historical Receiving rows. Only unambiguous matches
-- are backfilled; snapshots remain intact when no safe Catalog match exists.
UPDATE "LogisticsPurchaseOrderItem" AS item
SET "catalogItemId" = (
  SELECT catalog.id
  FROM "CatalogItem" AS catalog
  WHERE item."partNumber" IS NOT NULL
    AND (
      UPPER(catalog."partNumber") = UPPER(item."partNumber")
      OR UPPER(catalog."catalogPartNumber") = UPPER(item."partNumber")
    )
  ORDER BY catalog.id
  LIMIT 1
)
WHERE item."catalogItemId" IS NULL
  AND item."partNumber" IS NOT NULL
  AND 1 = (
    SELECT COUNT(*)
    FROM "CatalogItem" AS catalog
    WHERE UPPER(catalog."partNumber") = UPPER(item."partNumber")
       OR UPPER(catalog."catalogPartNumber") = UPPER(item."partNumber")
  );

UPDATE "LogisticsPurchaseOrderItem" AS item
SET "catalogItemId" = (
  SELECT catalog.id
  FROM "CatalogItem" AS catalog
  WHERE UPPER(catalog."description") = UPPER(item."partName")
  ORDER BY catalog.id
  LIMIT 1
)
WHERE item."catalogItemId" IS NULL
  AND 1 = (
    SELECT COUNT(*)
    FROM "CatalogItem" AS catalog
    WHERE UPPER(catalog."description") = UPPER(item."partName")
  );
