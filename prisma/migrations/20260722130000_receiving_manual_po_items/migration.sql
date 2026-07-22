CREATE TYPE "LogisticsPurchaseOrderItemSource" AS ENUM (
  'CATALOG',
  'MANUAL'
);

ALTER TABLE "LogisticsPurchaseOrderItem"
  ADD COLUMN "source" "LogisticsPurchaseOrderItemSource" NOT NULL DEFAULT 'CATALOG';

-- Historical rows that could not be linked during the Catalog backfill remain
-- valid Receiving snapshots and are explicitly treated as manual PO items.
UPDATE "LogisticsPurchaseOrderItem"
SET "source" = 'MANUAL'
WHERE "catalogItemId" IS NULL;
