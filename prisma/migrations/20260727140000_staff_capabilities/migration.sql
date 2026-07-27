-- CreateEnum
CREATE TYPE "StaffCapability" AS ENUM (
    'MEKTEK_DASHBOARD',
    'MEKTEK_SERVICE_ORDERS',
    'MEKTEK_CREATE_ORDERS',
    'MEKTEK_UPDATE_PROGRESS',
    'MEKTEK_MANAGE_PAYMENTS',
    'MEKTEK_MANAGE_SCHEDULE',
    'MEKTEK_CUSTOMER_TOOLS',
    'MEKTEK_CUSTOMERS',
    'MEKTEK_CATALOG',
    'MEKTEK_MONITORING_PO',
    'MEKTEK_RECEIVING',
    'MEKTEK_FINANCE',
    'MEKTEK_VOUCHERS'
);

-- AddColumn: staffCapabilities (default empty array)
ALTER TABLE "Users"
ADD COLUMN "staffCapabilities" "StaffCapability"[] NOT NULL DEFAULT ARRAY[]::"StaffCapability"[];

-- Backfill: preserve every existing sub-admin's current access so the
-- capability migration causes no access loss. Admins narrow capabilities via
-- the staff-management UI afterwards.
--
-- Broad divisions (OPERATIONS, CUSTOMER_SERVICE, TECHNICAL, HUMAN_RESOURCES)
-- get the full broad capability set that `isBroadDivisionStaff` granted.
-- FINANCE additionally gets MEKTEK_FINANCE.
-- LOGISTICS gets CATALOG plus the assigned area (or CATALOG only if area is
-- null, so they can still sign in).
UPDATE "Users"
SET "staffCapabilities" = CASE
  WHEN "staffDivision" = 'LOGISTICS' AND "logisticsStaffArea" = 'MONITORING_PO'
    THEN ARRAY['MEKTEK_CATALOG', 'MEKTEK_MONITORING_PO']::"StaffCapability"[]
  WHEN "staffDivision" = 'LOGISTICS' AND "logisticsStaffArea" = 'RECEIVING'
    THEN ARRAY['MEKTEK_CATALOG', 'MEKTEK_RECEIVING']::"StaffCapability"[]
  WHEN "staffDivision" = 'LOGISTICS'
    THEN ARRAY['MEKTEK_CATALOG']::"StaffCapability"[]
  WHEN "staffDivision" = 'FINANCE'
    THEN ARRAY[
      'MEKTEK_DASHBOARD','MEKTEK_SERVICE_ORDERS','MEKTEK_CREATE_ORDERS',
      'MEKTEK_UPDATE_PROGRESS','MEKTEK_MANAGE_PAYMENTS','MEKTEK_MANAGE_SCHEDULE',
      'MEKTEK_CUSTOMER_TOOLS','MEKTEK_CUSTOMERS','MEKTEK_CATALOG',
      'MEKTEK_VOUCHERS','MEKTEK_FINANCE'
    ]::"StaffCapability"[]
  WHEN "staffDivision" IS NOT NULL
    THEN ARRAY[
      'MEKTEK_DASHBOARD','MEKTEK_SERVICE_ORDERS','MEKTEK_CREATE_ORDERS',
      'MEKTEK_UPDATE_PROGRESS','MEKTEK_MANAGE_PAYMENTS','MEKTEK_MANAGE_SCHEDULE',
      'MEKTEK_CUSTOMER_TOOLS','MEKTEK_CUSTOMERS','MEKTEK_CATALOG',
      'MEKTEK_VOUCHERS'
    ]::"StaffCapability"[]
  ELSE ARRAY[]::"StaffCapability"[]
END
WHERE "staffDivision" IS NOT NULL;
