-- Every complete supplier bill saved by the old workflow becomes ready to pay.
UPDATE "FinanceSupplierBill"
SET
  "status" = 'POSTED',
  "postedAt" = COALESCE("postedAt", CURRENT_TIMESTAMP)
WHERE "status" IN ('DRAFT', 'PENDING_APPROVAL');

UPDATE "FinancePayableSource" AS source
SET "status" = 'BILLED'
FROM "FinanceSupplierBill" AS bill
WHERE
  source."supplierBillId" = bill."id"
  AND source."status" = 'DRAFTED'
  AND bill."status" IN ('POSTED', 'PARTIALLY_PAID', 'PAID');

-- Keep old approval rows as history, but close pending workflows that no longer
-- have an approval step. Pending disbursements are intentionally not posted;
-- Finance can record them again using the new direct-payment form.
UPDATE "FinanceApproval"
SET
  "status" = 'CANCELLED',
  "decidedAt" = COALESCE("decidedAt", CURRENT_TIMESTAMP),
  "reason" = COALESCE(
    NULLIF("reason", ''),
    'Dibatalkan otomatis: workflow ini tidak lagi memerlukan persetujuan.'
  )
WHERE
  "action" IN (
    'POST_SUPPLIER_BILL',
    'POST_DISBURSEMENT',
    'OVERRIDE_SUPPLY_CONFLICT'
  )
  AND "status" = 'PENDING';

-- Supply overlap is informational and no longer blocks Logistics.
UPDATE "LogisticsPurchaseOrder"
SET "supplyReviewStatus" = 'CLEAR'
WHERE "supplyReviewStatus" IN ('BLOCKED', 'OVERRIDDEN');

UPDATE "LogisticsSupplyAllocation"
SET
  "status" = 'CLEAR',
  "overrideApprovalId" = NULL
WHERE "status" IN ('BLOCKED', 'OVERRIDDEN');
