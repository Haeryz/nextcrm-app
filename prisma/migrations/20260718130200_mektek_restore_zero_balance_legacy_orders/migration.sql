-- The preceding legacy backfill intentionally moves unpaid closed orders into the
-- new review state. Preserve old closed orders whose stored work has no charge at
-- all: they have no payment to await and can remain fully closed.
UPDATE "crm_Accounts_Tasks" AS task
SET "taskStatus" = 'COMPLETE'::"taskStatus"
WHERE task."taskStatus" = 'AWAITING_PAYMENT'::"taskStatus"
  AND (
    task.title LIKE 'MEKTEK Service -%'
    OR task.title LIKE 'MEKTEK AC -%'
  )
  AND COALESCE(
    NULLIF(regexp_replace(task.tags->>'serviceSubtotal', '[^0-9]', '', 'g'), '')::numeric,
    0
  ) <= 0
  AND COALESCE(
    NULLIF(regexp_replace(task.tags->>'sparepartSubtotal', '[^0-9]', '', 'g'), '')::numeric,
    0
  ) <= 0
  AND COALESCE(
    NULLIF(regexp_replace(task.tags->>'subtotal', '[^0-9]', '', 'g'), '')::numeric,
    0
  ) <= 0
  AND COALESCE(task.content, '') !~* 'Rp\s*[1-9]'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(task.tags->'serviceItems') = 'array'
          THEN task.tags->'serviceItems'
        ELSE '[]'::jsonb
      END
    ) AS item
    WHERE COALESCE(
      NULLIF(regexp_replace(item->>'total', '[^0-9]', '', 'g'), '')::numeric,
      NULLIF(regexp_replace(item->>'unitPrice', '[^0-9]', '', 'g'), '')::numeric,
      NULLIF(regexp_replace(item->>'estimatedCost', '[^0-9]', '', 'g'), '')::numeric,
      0
    ) > 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(task.tags->'sparepartItems') = 'array'
          THEN task.tags->'sparepartItems'
        ELSE '[]'::jsonb
      END
    ) AS item
    WHERE COALESCE(
      NULLIF(regexp_replace(item->>'total', '[^0-9]', '', 'g'), '')::numeric,
      NULLIF(regexp_replace(item->>'unitPrice', '[^0-9]', '', 'g'), '')::numeric,
      NULLIF(regexp_replace(item->>'estimatedCost', '[^0-9]', '', 'g'), '')::numeric,
      0
    ) > 0
  );
