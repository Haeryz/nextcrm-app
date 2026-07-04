CREATE TYPE "CatalogCustomerType" AS ENUM ('STANDARD', 'B2B');

ALTER TABLE "CatalogCustomer"
ADD COLUMN "customerType" "CatalogCustomerType" NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "CatalogCustomer_customerType_idx" ON "CatalogCustomer"("customerType");
