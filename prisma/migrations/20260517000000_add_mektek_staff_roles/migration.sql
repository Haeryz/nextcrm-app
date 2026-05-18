CREATE TYPE "MektekStaffRole" AS ENUM ('CS', 'TECHNICIAN');

ALTER TABLE "Users"
ADD COLUMN "mektekRole" "MektekStaffRole";

CREATE INDEX "Users_mektekRole_idx" ON "Users"("mektekRole");
