-- Wipe Pesanan, Pelanggan, Monitoring PO, dan Receiving dari database.
-- Sisakan: Catalog/Item, Finance/Accounting, Technician, Voucher (umum), WhatsApp, Staff Users.
-- Dijalankan dalam transaction untuk safety.

BEGIN;

-- ============================================================
-- Step 1: Delete child records (FK constraints)
-- ============================================================

-- Service Orders (Pesanan) children
DELETE FROM "MektekPayment";
DELETE FROM "tasksComments";
DELETE FROM "CatalogServiceLink";

-- Customer (Pelanggan) children
DELETE FROM "CatalogCustomerVehicle";
DELETE FROM "WhatsAppOptOutToken";

-- Logistics PO children (Monitoring PO + Receiving)
DELETE FROM "LogisticsReceipt";
DELETE FROM "LogisticsSupplyAllocation";
DELETE FROM "LogisticsPurchaseOrderItem";

-- ============================================================
-- Step 2: Delete parent records
-- ============================================================

-- Service Orders (Pesanan)
DELETE FROM "crm_Accounts_Tasks";
DELETE FROM "MektekServiceMonthlySequence";

-- Customers (Pelanggan) — cascades to MektekVoucher with customerId
DELETE FROM "CatalogCustomer";
DELETE FROM "CustomerPhoneVerification";
DELETE FROM "CustomerEmailVerification";

-- Logistics POs (Monitoring PO + Receiving — all flow values)
DELETE FROM "LogisticsPurchaseOrder";

-- ============================================================
-- Step 3: Delete customer Users and their dependent records
-- Customer users = is_admin=false AND staffDivision IS NULL
--                  AND mektekRole IS NULL AND staffCapabilities is empty
-- Staff/admin accounts are NEVER touched.
-- ============================================================

DELETE FROM "CustomerSession"
WHERE "userId" IN (
  SELECT id FROM "Users"
  WHERE is_admin = false
    AND "staffDivision" IS NULL
    AND "mektekRole" IS NULL
    AND ("staffCapabilities" IS NULL OR "staffCapabilities" = ARRAY[]::"StaffCapability"[])
);

DELETE FROM "EmailUnsubscribeToken"
WHERE "userId" IN (
  SELECT id FROM "Users"
  WHERE is_admin = false
    AND "staffDivision" IS NULL
    AND "mektekRole" IS NULL
    AND ("staffCapabilities" IS NULL OR "staffCapabilities" = ARRAY[]::"StaffCapability"[])
);

DELETE FROM "UserEmailPreference"
WHERE "userId" IN (
  SELECT id FROM "Users"
  WHERE is_admin = false
    AND "staffDivision" IS NULL
    AND "mektekRole" IS NULL
    AND ("staffCapabilities" IS NULL OR "staffCapabilities" = ARRAY[]::"StaffCapability"[])
);

DELETE FROM "PasswordResetToken"
WHERE "userId" IN (
  SELECT id FROM "Users"
  WHERE is_admin = false
    AND "staffDivision" IS NULL
    AND "mektekRole" IS NULL
    AND ("staffCapabilities" IS NULL OR "staffCapabilities" = ARRAY[]::"StaffCapability"[])
);

DELETE FROM "Users"
WHERE is_admin = false
  AND "staffDivision" IS NULL
  AND "mektekRole" IS NULL
  AND ("staffCapabilities" IS NULL OR "staffCapabilities" = ARRAY[]::"StaffCapability"[]);

COMMIT;
