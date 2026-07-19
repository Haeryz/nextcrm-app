CREATE TABLE "MektekVoucherCodeDictionary" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "entries" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MektekVoucherCodeDictionary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MektekVoucherCodeDictionary_name_key"
ON "MektekVoucherCodeDictionary"("name");

CREATE INDEX "MektekVoucherCodeDictionary_updatedAt_idx"
ON "MektekVoucherCodeDictionary"("updatedAt");
