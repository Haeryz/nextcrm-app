CREATE TYPE "LogisticsStaffArea" AS ENUM (
  'MONITORING_PO',
  'RECEIVING'
);

ALTER TABLE "Users"
ADD COLUMN "logisticsStaffArea" "LogisticsStaffArea";

ALTER TABLE "Users"
ADD CONSTRAINT "Users_logisticsStaffArea_division_check"
CHECK (
  "logisticsStaffArea" IS NULL OR "staffDivision" = 'LOGISTICS'
);

CREATE INDEX "Users_logisticsStaffArea_idx" ON "Users"("logisticsStaffArea");
