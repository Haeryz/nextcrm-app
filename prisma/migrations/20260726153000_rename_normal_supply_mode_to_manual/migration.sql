UPDATE "LogisticsPurchaseOrder"
SET "poType" = 'Manual'
WHERE "flow" = 'OUTBOUND'
  AND LOWER("poType") = 'normal';
