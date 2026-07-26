-- AlterTable
ALTER TABLE "CatalogCustomer" ADD COLUMN     "whatsappOptedOutAt" TIMESTAMP(3),
ADD COLUMN     "whatsappOptedOutSource" VARCHAR(16);

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" UUID NOT NULL,
    "recipientHash" CHAR(64) NOT NULL,
    "recipientMasked" VARCHAR(24) NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "category" VARCHAR(16) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "error" TEXT,
    "sentById" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOptOutToken" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOptOutToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_sentAt_idx" ON "WhatsAppMessageLog"("sentAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_purpose_sentAt_idx" ON "WhatsAppMessageLog"("purpose", "sentAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_status_sentAt_idx" ON "WhatsAppMessageLog"("status", "sentAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_category_sentAt_idx" ON "WhatsAppMessageLog"("category", "sentAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_recipientHash_idx" ON "WhatsAppMessageLog"("recipientHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOptOutToken_tokenHash_key" ON "WhatsAppOptOutToken"("tokenHash");

-- CreateIndex
CREATE INDEX "WhatsAppOptOutToken_customerId_idx" ON "WhatsAppOptOutToken"("customerId");

-- CreateIndex
CREATE INDEX "WhatsAppOptOutToken_expiresAt_idx" ON "WhatsAppOptOutToken"("expiresAt");

-- CreateIndex
CREATE INDEX "CatalogCustomer_whatsappOptedOutAt_idx" ON "CatalogCustomer"("whatsappOptedOutAt");

-- AddForeignKey
ALTER TABLE "WhatsAppOptOutToken" ADD CONSTRAINT "WhatsAppOptOutToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

