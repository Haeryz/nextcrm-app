CREATE TYPE "MektekSupplierDebtTransactionKind" AS ENUM ('DEPOSIT', 'PAYMENT');
CREATE TYPE "MektekSupplierDebtPaymentSource" AS ENUM ('CASH', 'DEPOSIT');

CREATE TABLE "MektekSupplierDebtTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sheetKey" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "kind" "MektekSupplierDebtTransactionKind" NOT NULL,
    "paymentSource" "MektekSupplierDebtPaymentSource",
    "amount" DECIMAL(18,2) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MektekSupplierDebtTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MektekSupplierDebtTransaction_sheetKey_sourceRow_idx"
ON "MektekSupplierDebtTransaction"("sheetKey", "sourceRow");

CREATE INDEX "MektekSupplierDebtTransaction_sheetKey_kind_transactionDate_idx"
ON "MektekSupplierDebtTransaction"("sheetKey", "kind", "transactionDate");
