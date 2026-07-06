CREATE TYPE "MektekVoucherDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

CREATE TYPE "MektekVoucherScope" AS ENUM ('ALL', 'CUSTOMER_TYPE', 'CUSTOMER');

CREATE TABLE "MektekVoucher" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "discountType" "MektekVoucherDiscountType" NOT NULL,
    "discountAmount" INTEGER,
    "discountPercent" INTEGER,
    "maxDiscount" INTEGER,
    "scope" "MektekVoucherScope" NOT NULL DEFAULT 'ALL',
    "customerType" "CatalogCustomerType",
    "customerId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekVoucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MektekVoucher_code_key" ON "MektekVoucher"("code");
CREATE UNIQUE INDEX "MektekVoucher_normalizedCode_key" ON "MektekVoucher"("normalizedCode");
CREATE INDEX "MektekVoucher_scope_idx" ON "MektekVoucher"("scope");
CREATE INDEX "MektekVoucher_customerType_idx" ON "MektekVoucher"("customerType");
CREATE INDEX "MektekVoucher_customerId_idx" ON "MektekVoucher"("customerId");
CREATE INDEX "MektekVoucher_isActive_idx" ON "MektekVoucher"("isActive");
CREATE INDEX "MektekVoucher_startsAt_idx" ON "MektekVoucher"("startsAt");
CREATE INDEX "MektekVoucher_expiresAt_idx" ON "MektekVoucher"("expiresAt");

ALTER TABLE "MektekVoucher"
ADD CONSTRAINT "MektekVoucher_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
