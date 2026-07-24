-- CreateTable
CREATE TABLE "CustomerEmailVerification" (
    "id" UUID NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEmailVerification_emailNormalized_key" ON "CustomerEmailVerification"("emailNormalized");

-- CreateIndex
CREATE INDEX "CustomerEmailVerification_expiresAt_idx" ON "CustomerEmailVerification"("expiresAt");

-- CreateTable
CREATE TABLE "EmailUnsubscribeToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" VARCHAR(24) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailUnsubscribeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailUnsubscribeToken_tokenHash_key" ON "EmailUnsubscribeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailUnsubscribeToken_userId_idx" ON "EmailUnsubscribeToken"("userId");

-- CreateIndex
CREATE INDEX "EmailUnsubscribeToken_expiresAt_idx" ON "EmailUnsubscribeToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailUnsubscribeToken"
ADD CONSTRAINT "EmailUnsubscribeToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "Users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UserEmailPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "marketingOptedInAt" TIMESTAMP(3),
    "offersOptedInAt" TIMESTAMP(3),
    "marketingOptedOutAt" TIMESTAMP(3),
    "offersOptedOutAt" TIMESTAMP(3),
    "frequencyCaps" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailPreference_userId_key" ON "UserEmailPreference"("userId");

-- AddForeignKey
ALTER TABLE "UserEmailPreference"
ADD CONSTRAINT "UserEmailPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "Users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" UUID NOT NULL,
    "recipientHash" CHAR(64) NOT NULL,
    "userId" UUID,
    "purpose" VARCHAR(40) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "providerId" VARCHAR(120),
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_recipientHash_idx" ON "EmailLog"("recipientHash");

-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_purpose_sentAt_idx" ON "EmailLog"("purpose", "sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_status_sentAt_idx" ON "EmailLog"("status", "sentAt");

-- CreateTable
CREATE TABLE "MektekEmailTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MektekEmailTemplate_purpose_isActive_idx" ON "MektekEmailTemplate"("purpose", "isActive");

-- CreateIndex
CREATE INDEX "MektekEmailTemplate_createdById_idx" ON "MektekEmailTemplate"("createdById");

-- CreateIndex
CREATE INDEX "MektekEmailTemplate_updatedAt_idx" ON "MektekEmailTemplate"("updatedAt");

-- One active template per purpose (partial unique index — Prisma can't express this inline).
CREATE UNIQUE INDEX "MektekEmailTemplate_one_active_per_purpose"
ON "MektekEmailTemplate"("purpose")
WHERE "isActive" = true;

-- AddForeignKey
ALTER TABLE "MektekEmailTemplate"
ADD CONSTRAINT "MektekEmailTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BlockedEmailDomain" (
    "id" UUID NOT NULL,
    "domain" VARCHAR(180) NOT NULL,
    "source" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedEmailDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedEmailDomain_domain_key" ON "BlockedEmailDomain"("domain");

-- CreateIndex
CREATE INDEX "BlockedEmailDomain_domain_idx" ON "BlockedEmailDomain"("domain");

-- CreateIndex
CREATE INDEX "BlockedEmailDomain_source_idx" ON "BlockedEmailDomain"("source");
