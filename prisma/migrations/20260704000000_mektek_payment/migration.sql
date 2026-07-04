-- CreateTable
CREATE TABLE "MektekPayment" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "midtransOrderId" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "snapToken" TEXT,
    "redirectUrl" TEXT,
    "paymentType" TEXT,
    "transactionStatus" TEXT NOT NULL DEFAULT 'pending',
    "fraudStatus" TEXT,
    "rawPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MektekPayment_midtransOrderId_key" ON "MektekPayment"("midtransOrderId");

-- CreateIndex
CREATE INDEX "MektekPayment_serviceOrderId_idx" ON "MektekPayment"("serviceOrderId");

-- CreateIndex
CREATE INDEX "MektekPayment_transactionStatus_idx" ON "MektekPayment"("transactionStatus");

-- CreateIndex
CREATE INDEX "MektekPayment_createdAt_idx" ON "MektekPayment"("createdAt");

-- AddForeignKey
ALTER TABLE "MektekPayment"
  ADD CONSTRAINT "MektekPayment_serviceOrderId_fkey"
  FOREIGN KEY ("serviceOrderId") REFERENCES "crm_Accounts_Tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
