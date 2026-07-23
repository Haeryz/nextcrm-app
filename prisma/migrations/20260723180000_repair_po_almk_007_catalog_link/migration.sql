-- PO-ALMK-007 was linked to the duplicate Cabin Air Filter HD785-7 catalog
-- record. Link its Filter AC line to the intended stocked catalog record.
UPDATE "LogisticsPurchaseOrderItem" AS item
SET
  "catalogItemId" = 'filter-ac-64c0c9c521',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "LogisticsPurchaseOrder" AS purchase_order
WHERE item."purchaseOrderId" = purchase_order."id"
  AND purchase_order."flow" = 'OUTBOUND'
  AND purchase_order."poNumber" = 'PO-ALMK-007'
  AND item."source" = 'CATALOG'
  AND item."partNumber" = '145520-7855'
  AND item."catalogItemId" = 'hd785-7-5ab517536a54'
  AND EXISTS (
    SELECT 1
    FROM "CatalogItem" AS catalog_item
    WHERE catalog_item."id" = 'filter-ac-64c0c9c521'
      AND catalog_item."partNumber" = '145520-7855'
  );
