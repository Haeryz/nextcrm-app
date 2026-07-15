-- Dedicated, revocable customer sessions. Only a SHA-256 hash of the opaque
-- browser token is stored so a database read alone cannot replay live sessions.
ALTER TABLE "Users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CustomerSession" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "rememberDevice" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_userId_idx" ON "CustomerSession"("userId");
CREATE INDEX "CustomerSession_idleExpiresAt_idx" ON "CustomerSession"("idleExpiresAt");
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");
CREATE INDEX "CustomerSession_revokedAt_idx" ON "CustomerSession"("revokedAt");

ALTER TABLE "CustomerSession"
ADD CONSTRAINT "CustomerSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "Users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Database-backed throttling coordinates login limits across serverless instances.
CREATE TABLE "AuthRateLimit" (
    "keyHash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "AuthRateLimit_blockedUntil_idx" ON "AuthRateLimit"("blockedUntil");
CREATE INDEX "AuthRateLimit_updatedAt_idx" ON "AuthRateLimit"("updatedAt");
