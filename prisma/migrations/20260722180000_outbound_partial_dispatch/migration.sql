-- Monitoring PO created before partial dispatch support already reduced stock in
-- full at creation time. Preserve that audit truth by marking legacy rows fulfilled.
UPDATE "LogisticsPurchaseOrderItem" AS item
SET
  "receivedQuantity" = item."orderedQuantity",
  "status" = 'CLOSED'
FROM "LogisticsPurchaseOrder" AS purchase_order
WHERE
  item."purchaseOrderId" = purchase_order."id"
  AND purchase_order."flow" = 'OUTBOUND';

UPDATE "LogisticsPurchaseOrder"
SET "status" = 'CLOSED'
WHERE "flow" = 'OUTBOUND';
