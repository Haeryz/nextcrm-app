CREATE TABLE "MektekWhatsAppMessageTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "body" TEXT NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekWhatsAppMessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MektekWhatsAppMessageTemplate_purpose_isActive_idx"
ON "MektekWhatsAppMessageTemplate"("purpose", "isActive");

CREATE INDEX "MektekWhatsAppMessageTemplate_createdById_idx"
ON "MektekWhatsAppMessageTemplate"("createdById");

CREATE INDEX "MektekWhatsAppMessageTemplate_updatedAt_idx"
ON "MektekWhatsAppMessageTemplate"("updatedAt");

CREATE UNIQUE INDEX "MektekWhatsAppMessageTemplate_one_active_per_purpose"
ON "MektekWhatsAppMessageTemplate"("purpose")
WHERE "isActive" = true;

ALTER TABLE "MektekWhatsAppMessageTemplate"
ADD CONSTRAINT "MektekWhatsAppMessageTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
