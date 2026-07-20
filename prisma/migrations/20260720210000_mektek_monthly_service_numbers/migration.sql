-- Keep the UUID primary key for internal relations and add a short, user-facing
-- service number whose counter restarts for each Makassar calendar month.
ALTER TABLE "crm_Accounts_Tasks"
ADD COLUMN "serviceNumber" VARCHAR(32);

CREATE TABLE "MektekServiceMonthlySequence" (
    "monthKey" VARCHAR(6) NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekServiceMonthlySequence_pkey" PRIMARY KEY ("monthKey")
);

-- Existing rows are numbered deterministically in their Asia/Makassar month.
-- Prisma DateTime columns store UTC values as timestamp, hence the +08:00 shift.
WITH ranked_orders AS (
    SELECT
        "id",
        TO_CHAR(
            COALESCE("createdAt", TIMESTAMP '1970-01-01 00:00:00') + INTERVAL '8 hours',
            'YYYYMM'
        ) AS month_key,
        ROW_NUMBER() OVER (
            PARTITION BY TO_CHAR(
                COALESCE("createdAt", TIMESTAMP '1970-01-01 00:00:00') + INTERVAL '8 hours',
                'YYYYMM'
            )
            ORDER BY "createdAt" ASC NULLS LAST, "id" ASC
        ) AS sequence_value
    FROM "crm_Accounts_Tasks"
    WHERE "title" LIKE 'MEKTEK Service -%'
       OR "title" LIKE 'MEKTEK AC -%'
)
UPDATE "crm_Accounts_Tasks" AS task
SET "serviceNumber" =
    'SRV-' || ranked_orders.month_key || '-' || LPAD(ranked_orders.sequence_value::text, 4, '0')
FROM ranked_orders
WHERE task."id" = ranked_orders."id";

INSERT INTO "MektekServiceMonthlySequence" (
    "monthKey",
    "lastValue",
    "createdAt",
    "updatedAt"
)
SELECT
    SUBSTRING("serviceNumber" FROM 5 FOR 6),
    MAX(SPLIT_PART("serviceNumber", '-', 3)::integer),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "crm_Accounts_Tasks"
WHERE "serviceNumber" IS NOT NULL
GROUP BY SUBSTRING("serviceNumber" FROM 5 FOR 6);

CREATE UNIQUE INDEX "crm_Accounts_Tasks_serviceNumber_key"
ON "crm_Accounts_Tasks"("serviceNumber");
