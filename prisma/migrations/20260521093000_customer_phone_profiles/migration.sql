ALTER TABLE "Users" ADD COLUMN "phone" TEXT;
ALTER TABLE "Users" ADD COLUMN "phoneNormalized" TEXT;

ALTER TABLE "CatalogCustomer" ADD COLUMN "userId" UUID;

CREATE UNIQUE INDEX "Users_phoneNormalized_key" ON "Users"("phoneNormalized");
CREATE INDEX "Users_phoneNormalized_idx" ON "Users"("phoneNormalized");

CREATE UNIQUE INDEX "CatalogCustomer_userId_key" ON "CatalogCustomer"("userId");
CREATE INDEX "CatalogCustomer_userId_idx" ON "CatalogCustomer"("userId");

ALTER TABLE "CatalogCustomer"
  ADD CONSTRAINT "CatalogCustomer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
