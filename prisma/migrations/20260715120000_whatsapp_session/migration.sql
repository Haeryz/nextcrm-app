-- The paired WhatsApp (Baileys) session. Serverless instances share no filesystem
-- and keep nothing between invocations, so the session cannot live on disk the way
-- the old whatsapp-web.js LocalAuth profile did — Postgres is the only thing that
-- survives a redeploy, and is therefore the source of truth.
--
-- "credsCipher" is AES-256-GCM(BufferJSON(creds)) under EMAIL_ENCRYPTION_KEY. It
-- grants full send-as-the-business access, so it is never stored in the clear.
--
-- "lockOwner"/"lockedUntil" are a compare-and-swap lease: two sockets on the same
-- credentials make WhatsApp kick one off (440 connectionReplaced), so only one
-- invocation may hold a connection at a time. The lease self-expires so a crashed
-- invocation cannot deadlock sending forever.
CREATE TABLE "WhatsAppSession" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "credsCipher" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_linked',
    "sessionPhone" TEXT,
    "lastError" TEXT,
    "lastQrAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppSession_slug_key" ON "WhatsAppSession"("slug");
CREATE INDEX "WhatsAppSession_lockedUntil_idx" ON "WhatsAppSession"("lockedUntil");

-- Signal-protocol key material (pre-keys, sessions, sender keys, app-state sync
-- keys). Stored as one row per key rather than a single blob: a send touches only a
-- handful of keys, so rewriting the whole keyspace each time would be both slow and
-- a lost-update race between concurrent writes.
CREATE TABLE "WhatsAppSignalKey" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "valCipher" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSignalKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppSignalKey_sessionId_type_keyId_key" ON "WhatsAppSignalKey"("sessionId", "type", "keyId");
CREATE INDEX "WhatsAppSignalKey_sessionId_type_idx" ON "WhatsAppSignalKey"("sessionId", "type");

-- Cascade: orphaned key rows would silently corrupt a later re-pair.
ALTER TABLE "WhatsAppSignalKey"
ADD CONSTRAINT "WhatsAppSignalKey_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the singleton row. The lease is acquired with a conditional UPDATE, which
-- matches zero rows (and so can never be acquired) if the row does not exist yet.
INSERT INTO "WhatsAppSession" ("id", "slug", "status", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'default', 'not_linked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
