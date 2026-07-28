ALTER TABLE "CatalogCustomer"
ADD COLUMN "customerNumber" VARCHAR(24);

CREATE UNIQUE INDEX "CatalogCustomer_customerNumber_key"
ON "CatalogCustomer"("customerNumber");

ALTER TABLE "LogisticsPurchaseOrder"
ADD COLUMN "sourceServiceOrderId" UUID;

CREATE UNIQUE INDEX "LogisticsPurchaseOrder_sourceServiceOrderId_key"
ON "LogisticsPurchaseOrder"("sourceServiceOrderId");

ALTER TABLE "LogisticsPurchaseOrder"
ADD CONSTRAINT "LogisticsPurchaseOrder_sourceServiceOrderId_fkey"
FOREIGN KEY ("sourceServiceOrderId")
REFERENCES "crm_Accounts_Tasks"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
