CREATE TABLE "CatalogCustomerVehicle" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "plateNumberNormalized" TEXT NOT NULL,
  "fleetNumber" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "lastServiceAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogCustomerVehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogCustomerVehicle_customerId_plateNumberNormalized_key"
ON "CatalogCustomerVehicle"("customerId", "plateNumberNormalized");

CREATE INDEX "CatalogCustomerVehicle_customerId_isPrimary_idx"
ON "CatalogCustomerVehicle"("customerId", "isPrimary");

CREATE INDEX "CatalogCustomerVehicle_plateNumberNormalized_idx"
ON "CatalogCustomerVehicle"("plateNumberNormalized");

CREATE INDEX "CatalogCustomerVehicle_lastServiceAt_idx"
ON "CatalogCustomerVehicle"("lastServiceAt");

ALTER TABLE "CatalogCustomerVehicle"
ADD CONSTRAINT "CatalogCustomerVehicle_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing single-vehicle profile as the customer's first vehicle.
INSERT INTO "CatalogCustomerVehicle" (
  "id",
  "customerId",
  "name",
  "plateNumber",
  "plateNumberNormalized",
  "fleetNumber",
  "isPrimary",
  "lastServiceAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  "id",
  COALESCE(NULLIF(trim("vehicleName"), ''), 'Kendaraan'),
  upper(trim("vehiclePlateNumber")),
  upper(regexp_replace(trim("vehiclePlateNumber"), '[^A-Za-z0-9]', '', 'g')),
  NULLIF(trim("vehicleFleetNumber"), ''),
  true,
  "updatedAt",
  "createdAt",
  "updatedAt"
FROM "CatalogCustomer"
WHERE NULLIF(trim("vehiclePlateNumber"), '') IS NOT NULL
  AND upper(regexp_replace(trim("vehiclePlateNumber"), '[^A-Za-z0-9]', '', 'g')) <> ''
ON CONFLICT ("customerId", "plateNumberNormalized") DO NOTHING;

-- Recover every distinct vehicle already present in linked service-order tags,
-- not only the most recently copied legacy profile columns.
WITH historical_vehicles AS (
  SELECT DISTINCT ON (
    link."customerId",
    upper(regexp_replace(trim(task."tags" ->> 'vehiclePlateNumber'), '[^A-Za-z0-9]', '', 'g'))
  )
    link."customerId",
    COALESCE(NULLIF(trim(task."tags" ->> 'vehicle'), ''), 'Kendaraan') AS "name",
    upper(trim(task."tags" ->> 'vehiclePlateNumber')) AS "plateNumber",
    upper(regexp_replace(trim(task."tags" ->> 'vehiclePlateNumber'), '[^A-Za-z0-9]', '', 'g')) AS "plateNumberNormalized",
    NULLIF(trim(task."tags" ->> 'vehicleFleetNumber'), '') AS "fleetNumber",
    COALESCE(task."updatedAt", task."createdAt", link."createdAt") AS "lastServiceAt"
  FROM "CatalogServiceLink" AS link
  INNER JOIN "crm_Accounts_Tasks" AS task
    ON task."id" = link."serviceOrderId"
  WHERE NULLIF(trim(task."tags" ->> 'vehiclePlateNumber'), '') IS NOT NULL
    AND upper(regexp_replace(trim(task."tags" ->> 'vehiclePlateNumber'), '[^A-Za-z0-9]', '', 'g')) <> ''
  ORDER BY
    link."customerId",
    upper(regexp_replace(trim(task."tags" ->> 'vehiclePlateNumber'), '[^A-Za-z0-9]', '', 'g')),
    COALESCE(task."updatedAt", task."createdAt", link."createdAt") DESC
), ranked_vehicles AS (
  SELECT
    historical_vehicles.*,
    row_number() OVER (
      PARTITION BY "customerId"
      ORDER BY "lastServiceAt" DESC
    ) AS "vehicleRank"
  FROM historical_vehicles
)
INSERT INTO "CatalogCustomerVehicle" (
  "id",
  "customerId",
  "name",
  "plateNumber",
  "plateNumberNormalized",
  "fleetNumber",
  "isPrimary",
  "lastServiceAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  ranked."customerId",
  ranked."name",
  ranked."plateNumber",
  ranked."plateNumberNormalized",
  ranked."fleetNumber",
  ranked."vehicleRank" = 1
    AND NOT EXISTS (
      SELECT 1
      FROM "CatalogCustomerVehicle" AS existing_vehicle
      WHERE existing_vehicle."customerId" = ranked."customerId"
    ),
  ranked."lastServiceAt",
  ranked."lastServiceAt",
  ranked."lastServiceAt"
FROM ranked_vehicles AS ranked
ON CONFLICT ("customerId", "plateNumberNormalized") DO UPDATE SET
  "name" = EXCLUDED."name",
  "plateNumber" = EXCLUDED."plateNumber",
  "fleetNumber" = COALESCE(EXCLUDED."fleetNumber", "CatalogCustomerVehicle"."fleetNumber"),
  "lastServiceAt" = COALESCE(
    GREATEST("CatalogCustomerVehicle"."lastServiceAt", EXCLUDED."lastServiceAt"),
    "CatalogCustomerVehicle"."lastServiceAt",
    EXCLUDED."lastServiceAt"
  ),
  "updatedAt" = EXCLUDED."updatedAt";
