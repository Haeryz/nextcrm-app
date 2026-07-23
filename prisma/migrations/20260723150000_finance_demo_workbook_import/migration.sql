CREATE TABLE "FinanceDemoImport" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "metadata" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceDemoImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceDemoRow" (
    "id" UUID NOT NULL,
    "importId" UUID NOT NULL,
    "sheetKey" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceDemoRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinanceCounterparty" ADD COLUMN "demoImportId" UUID;
ALTER TABLE "FinanceInvoice" ADD COLUMN "demoImportId" UUID;

CREATE UNIQUE INDEX "FinanceDemoImport_label_key" ON "FinanceDemoImport"("label");
CREATE UNIQUE INDEX "FinanceDemoRow_importId_sheetKey_sourceRow_key"
ON "FinanceDemoRow"("importId", "sheetKey", "sourceRow");
CREATE INDEX "FinanceDemoRow_sheetKey_sourceRow_idx" ON "FinanceDemoRow"("sheetKey", "sourceRow");
CREATE INDEX "FinanceDemoRow_importId_idx" ON "FinanceDemoRow"("importId");
CREATE INDEX "FinanceCounterparty_demoImportId_idx" ON "FinanceCounterparty"("demoImportId");
CREATE INDEX "FinanceInvoice_demoImportId_idx" ON "FinanceInvoice"("demoImportId");

ALTER TABLE "FinanceCounterparty"
ADD CONSTRAINT "FinanceCounterparty_demoImportId_fkey"
FOREIGN KEY ("demoImportId") REFERENCES "FinanceDemoImport"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceInvoice"
ADD CONSTRAINT "FinanceInvoice_demoImportId_fkey"
FOREIGN KEY ("demoImportId") REFERENCES "FinanceDemoImport"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceDemoRow"
ADD CONSTRAINT "FinanceDemoRow_importId_fkey"
FOREIGN KEY ("importId") REFERENCES "FinanceDemoImport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
