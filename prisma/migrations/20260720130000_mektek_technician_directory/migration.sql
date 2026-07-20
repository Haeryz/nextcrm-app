CREATE TYPE "MektekTechnicianRole" AS ENUM ('MECHANIC', 'HELPER', 'OJT');

CREATE TABLE "MektekTechnician" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "role" "MektekTechnicianRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MektekTechnician_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MektekTechnician_name_role_key"
ON "MektekTechnician"("name", "role");
CREATE INDEX "MektekTechnician_isActive_idx" ON "MektekTechnician"("isActive");
CREATE INDEX "MektekTechnician_role_idx" ON "MektekTechnician"("role");
CREATE INDEX "MektekTechnician_name_idx" ON "MektekTechnician"("name");

INSERT INTO "MektekTechnician" ("id", "name", "role", "updatedAt") VALUES
  ('20000000-0000-0000-0000-000000000001', 'Winarto', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000002', 'Ahmad', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000003', 'Dicko', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000004', 'Saryanto', 'HELPER', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000005', 'Widodo', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000006', 'Yudha', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000007', 'Rizki Ridwan', 'MECHANIC', CURRENT_TIMESTAMP),
  ('20000000-0000-0000-0000-000000000008', 'Wildan', 'OJT', CURRENT_TIMESTAMP)
ON CONFLICT ("name", "role") DO NOTHING;
