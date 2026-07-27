-- Backfill staffCapabilities for the simplified sub-admin matrix:
--   1. Anyone who could access the accounting/finance workspace via MEKTEK_FINANCE
--      keeps that access AND gains MEKTEK_ACCOUNTING so the split causes no loss.
--   2. The nine granular customer-service capabilities collapse into the single
--      MEKTEK_CUSTOMER_SERVICE bundle. Old values are removed from stored arrays.
-- The nine removed enum values remain in the Postgres type (unused) to avoid a
-- risky enum type recreation; the Prisma schema lists only the six active values.

-- Step 1: grant MEKTEK_ACCOUNTING alongside existing MEKTEK_FINANCE (no access loss).
UPDATE "Users" SET "staffCapabilities" = array_append("staffCapabilities", 'MEKTEK_ACCOUNTING'::"StaffCapability")
WHERE array_position("staffCapabilities", 'MEKTEK_FINANCE'::"StaffCapability") IS NOT NULL
  AND array_position("staffCapabilities", 'MEKTEK_ACCOUNTING'::"StaffCapability") IS NULL;

-- Step 2: collapse the nine customer-service capabilities into MEKTEK_CUSTOMER_SERVICE
-- and drop the removed values from every stored array.
UPDATE "Users" SET "staffCapabilities" = (
  SELECT ARRAY(
    SELECT DISTINCT mapped FROM (
      SELECT CASE
        WHEN elem IN (
          'MEKTEK_DASHBOARD','MEKTEK_SERVICE_ORDERS','MEKTEK_CREATE_ORDERS','MEKTEK_UPDATE_PROGRESS',
          'MEKTEK_MANAGE_PAYMENTS','MEKTEK_MANAGE_SCHEDULE','MEKTEK_CUSTOMER_TOOLS','MEKTEK_CUSTOMERS','MEKTEK_VOUCHERS'
        ) THEN 'MEKTEK_CUSTOMER_SERVICE'::text
        ELSE elem::text
      END AS mapped
      FROM unnest("staffCapabilities") AS t(elem)
    ) s
    WHERE mapped IS NOT NULL
    ORDER BY mapped
  )::"StaffCapability"[]
)
WHERE array_length("staffCapabilities", 1) IS NOT NULL;
