-- A later historical migration rebuilds this table and first removes a
-- constraint from it. Some existing databases had the earlier partial table,
-- while a clean database does not. This compatibility shell makes that rebuild
-- safe without modifying the checksum of an already-deployed migration.
CREATE TABLE IF NOT EXISTS "CatalogConsignmentSite" (
  "id" TEXT NOT NULL,
  CONSTRAINT "CatalogConsignmentSite_pkey" PRIMARY KEY ("id")
);
