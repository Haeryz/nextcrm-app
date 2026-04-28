-- Move customer catalogue data and image bytes into Postgres.

CREATE TABLE IF NOT EXISTS "CatalogImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mimeType" TEXT NOT NULL,
  "bytes" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CatalogImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CatalogItem" (
  "id" TEXT NOT NULL,
  "machine" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "illustration" TEXT,
  "partNumber" TEXT,
  "catalogPartNumber" TEXT,
  "description" TEXT NOT NULL,
  "quantity" TEXT,
  "price" INTEGER,
  "remark" TEXT,
  "searchText" TEXT NOT NULL,
  "imageId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogItem_machine_idx"
  ON "CatalogItem"("machine");
CREATE INDEX IF NOT EXISTS "CatalogItem_imageId_idx"
  ON "CatalogItem"("imageId");
CREATE INDEX IF NOT EXISTS "CatalogItem_description_idx"
  ON "CatalogItem"("description");

DO $$ BEGIN
  ALTER TABLE "CatalogItem"
    ADD CONSTRAINT "CatalogItem_imageId_fkey"
    FOREIGN KEY ("imageId") REFERENCES "CatalogImage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
