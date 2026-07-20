-- Catalogue inventory is tracked independently for the rear and front warehouses.
CREATE TYPE "CatalogProductionChannel" AS ENUM ('POWERTRAIN', 'THERMAL');
CREATE TYPE "CatalogWarehouse" AS ENUM ('REAR', 'FRONT');
CREATE TYPE "CatalogStockDirection" AS ENUM ('IN', 'OUT');

ALTER TABLE "CatalogItem"
ADD COLUMN "productionChannel" "CatalogProductionChannel",
ADD COLUMN "rearLocation" TEXT,
ADD COLUMN "frontLocation" TEXT,
ADD COLUMN "rearStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "frontStock" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CatalogInventoryMonth" (
    "id" UUID NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "openingRearStock" INTEGER NOT NULL DEFAULT 0,
    "openingFrontStock" INTEGER NOT NULL DEFAULT 0,
    "closingRearStock" INTEGER NOT NULL DEFAULT 0,
    "closingFrontStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogInventoryMonth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogStockMovement" (
    "id" UUID NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "inventoryMonthId" UUID NOT NULL,
    "warehouse" "CatalogWarehouse" NOT NULL,
    "direction" "CatalogStockDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogInventoryMonth_catalogItemId_month_key"
ON "CatalogInventoryMonth"("catalogItemId", "month");
CREATE INDEX "CatalogInventoryMonth_month_idx"
ON "CatalogInventoryMonth"("month");
CREATE INDEX "CatalogStockMovement_catalogItemId_occurredAt_idx"
ON "CatalogStockMovement"("catalogItemId", "occurredAt");
CREATE INDEX "CatalogStockMovement_inventoryMonthId_idx"
ON "CatalogStockMovement"("inventoryMonthId");
CREATE INDEX "CatalogItem_productionChannel_idx"
ON "CatalogItem"("productionChannel");

ALTER TABLE "CatalogInventoryMonth"
ADD CONSTRAINT "CatalogInventoryMonth_catalogItemId_fkey"
FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogStockMovement"
ADD CONSTRAINT "CatalogStockMovement_catalogItemId_fkey"
FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogStockMovement"
ADD CONSTRAINT "CatalogStockMovement_inventoryMonthId_fkey"
FOREIGN KEY ("inventoryMonthId") REFERENCES "CatalogInventoryMonth"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve a numeric legacy quantity as the initial rear-warehouse balance.
-- Non-numeric catalogue quantities remain zero and can be established through
-- the inventory screen without guessing a stock value.
UPDATE "CatalogItem"
SET "rearStock" = CASE
  WHEN trim(COALESCE("quantity", '')) ~ '^[0-9]+$'
    THEN trim("quantity")::integer
  ELSE 0
END;

-- Existing catalogue items receive an opening ledger in the migration month.
INSERT INTO "CatalogInventoryMonth" (
  "id",
  "catalogItemId",
  "month",
  "openingRearStock",
  "openingFrontStock",
  "closingRearStock",
  "closingFrontStock",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  "id",
  date_trunc('month', CURRENT_DATE)::date,
  "rearStock",
  0,
  "rearStock",
  0,
  CURRENT_TIMESTAMP
FROM "CatalogItem";
