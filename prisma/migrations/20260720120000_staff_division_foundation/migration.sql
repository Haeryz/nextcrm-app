CREATE TYPE "StaffDivision" AS ENUM (
  'OPERATIONS',
  'CUSTOMER_SERVICE',
  'TECHNICAL',
  'LOGISTICS',
  'FINANCE',
  'HUMAN_RESOURCES'
);

ALTER TABLE "Users"
ADD COLUMN "staffDivision" "StaffDivision";

CREATE INDEX "Users_staffDivision_idx" ON "Users"("staffDivision");
