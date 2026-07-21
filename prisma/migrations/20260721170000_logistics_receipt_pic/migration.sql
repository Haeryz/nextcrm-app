CREATE TABLE "LogisticsPic" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LogisticsPic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogisticsPic_name_key" ON "LogisticsPic"("name");
CREATE INDEX "LogisticsPic_isActive_name_idx" ON "LogisticsPic"("isActive", "name");

INSERT INTO "LogisticsPic" ("id", "name", "updatedAt") VALUES
  ('30000000-0000-0000-0000-000000000001', 'PIC 1', CURRENT_TIMESTAMP),
  ('30000000-0000-0000-0000-000000000002', 'PIC 2', CURRENT_TIMESTAMP),
  ('30000000-0000-0000-0000-000000000003', 'PIC 3', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "LogisticsReceipt" ADD COLUMN "picId" UUID;

UPDATE "LogisticsReceipt"
SET "picId" = (
  SELECT "id" FROM "LogisticsPic" WHERE "name" = 'PIC 1' LIMIT 1
)
WHERE "picId" IS NULL;

ALTER TABLE "LogisticsReceipt" ALTER COLUMN "picId" SET NOT NULL;
CREATE INDEX "LogisticsReceipt_picId_receivedAt_idx"
ON "LogisticsReceipt"("picId", "receivedAt");
ALTER TABLE "LogisticsReceipt"
ADD CONSTRAINT "LogisticsReceipt_picId_fkey"
FOREIGN KEY ("picId") REFERENCES "LogisticsPic"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
