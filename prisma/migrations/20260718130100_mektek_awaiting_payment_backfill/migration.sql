UPDATE "crm_Accounts_Tasks" AS task
SET "taskStatus" = 'AWAITING_PAYMENT'::"taskStatus"
WHERE task."taskStatus" = 'COMPLETE'::"taskStatus"
  AND (
    task.title LIKE 'MEKTEK Service -%'
    OR task.title LIKE 'MEKTEK AC -%'
  )
  AND COALESCE(task.tags->>'orderSource', '') <> 'customer_storefront'
  AND COALESCE(task.tags->'payment'->>'status', 'unpaid') <> 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM "MektekPayment" AS payment
    WHERE payment."serviceOrderId" = task.id
      AND payment."paidAt" IS NOT NULL
  );
