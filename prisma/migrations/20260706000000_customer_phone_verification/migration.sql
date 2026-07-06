-- CreateTable
CREATE TABLE "CustomerPhoneVerification" (
    "id" UUID NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPhoneVerification_phoneNormalized_key" ON "CustomerPhoneVerification"("phoneNormalized");

-- CreateIndex
CREATE INDEX "CustomerPhoneVerification_expiresAt_idx" ON "CustomerPhoneVerification"("expiresAt");
