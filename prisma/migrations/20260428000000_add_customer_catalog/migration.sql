-- Add lightweight customer catalogue auth, inquiries, and service links.

DO $$ BEGIN
  CREATE TYPE "CatalogInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CatalogServiceLinkSource" AS ENUM ('PHONE_MATCH', 'TOKEN_LINK', 'ADMIN_ASSIGN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CatalogCustomer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "username" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "phoneNormalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogCustomerSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tokenHash" TEXT NOT NULL,
  "customerId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),

  CONSTRAINT "CatalogCustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogInquiry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "items" JSONB NOT NULL,
  "note" TEXT,
  "status" "CatalogInquiryStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogInquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogServiceLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "serviceOrderId" UUID NOT NULL,
  "source" "CatalogServiceLinkSource" NOT NULL,
  "token" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CatalogServiceLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCustomer_phoneNormalized_key"
  ON "CatalogCustomer"("phoneNormalized");
CREATE INDEX IF NOT EXISTS "CatalogCustomer_phoneNormalized_idx"
  ON "CatalogCustomer"("phoneNormalized");
CREATE INDEX IF NOT EXISTS "CatalogCustomer_createdAt_idx"
  ON "CatalogCustomer"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCustomerSession_tokenHash_key"
  ON "CatalogCustomerSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "CatalogCustomerSession_customerId_idx"
  ON "CatalogCustomerSession"("customerId");
CREATE INDEX IF NOT EXISTS "CatalogCustomerSession_expiresAt_idx"
  ON "CatalogCustomerSession"("expiresAt");

CREATE INDEX IF NOT EXISTS "CatalogInquiry_customerId_idx"
  ON "CatalogInquiry"("customerId");
CREATE INDEX IF NOT EXISTS "CatalogInquiry_status_idx"
  ON "CatalogInquiry"("status");
CREATE INDEX IF NOT EXISTS "CatalogInquiry_createdAt_idx"
  ON "CatalogInquiry"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogServiceLink_customerId_serviceOrderId_key"
  ON "CatalogServiceLink"("customerId", "serviceOrderId");
CREATE INDEX IF NOT EXISTS "CatalogServiceLink_customerId_idx"
  ON "CatalogServiceLink"("customerId");
CREATE INDEX IF NOT EXISTS "CatalogServiceLink_serviceOrderId_idx"
  ON "CatalogServiceLink"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "CatalogServiceLink_source_idx"
  ON "CatalogServiceLink"("source");

DO $$ BEGIN
  ALTER TABLE "CatalogCustomerSession"
    ADD CONSTRAINT "CatalogCustomerSession_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogInquiry"
    ADD CONSTRAINT "CatalogInquiry_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogServiceLink"
    ADD CONSTRAINT "CatalogServiceLink_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogServiceLink"
    ADD CONSTRAINT "CatalogServiceLink_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "crm_Accounts_Tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
