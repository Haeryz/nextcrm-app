-- Add the two new StaffCapability values used by the simplified sub-admin matrix.
-- This migration only ADDs values; the backfill that USES them runs in the next
-- migration so the new enum values are committed before any row references them
-- (PostgreSQL does not allow using a value added in the same transaction).

ALTER TYPE "StaffCapability" ADD VALUE IF NOT EXISTS 'MEKTEK_CUSTOMER_SERVICE';
ALTER TYPE "StaffCapability" ADD VALUE IF NOT EXISTS 'MEKTEK_ACCOUNTING';
