-- Track supplier purchase orders, partial receipts, and outstanding quantities.
-- Status is advanced by server actions; users cannot manually close a PO.
CREATE TYPE "LogisticsPurchaseOrderStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "LogisticsPurchaseOrder" (
    "id" UUID NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "inputDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "poType" TEXT NOT NULL DEFAULT 'Normal',
    "status" "LogisticsPurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsPurchaseOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LogisticsPurchaseOrder_dueDate_check" CHECK ("dueDate" >= "inputDate")
);

CREATE TABLE "LogisticsPurchaseOrderItem" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "partName" TEXT NOT NULL,
    "partNumber" TEXT,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "LogisticsPurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsPurchaseOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LogisticsPurchaseOrderItem_orderedQuantity_check" CHECK ("orderedQuantity" > 0),
    CONSTRAINT "LogisticsPurchaseOrderItem_receivedQuantity_check" CHECK (
        "receivedQuantity" >= 0 AND "receivedQuantity" <= "orderedQuantity"
    )
);

CREATE TABLE "LogisticsReceipt" (
    "id" UUID NOT NULL,
    "purchaseOrderItemId" UUID NOT NULL,
    "deliveryNoteNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedAt" DATE NOT NULL,
    "note" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogisticsReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LogisticsReceipt_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "LogisticsPurchaseOrder_poNumber_key"
ON "LogisticsPurchaseOrder"("poNumber");
CREATE INDEX "LogisticsPurchaseOrder_status_dueDate_idx"
ON "LogisticsPurchaseOrder"("status", "dueDate");
CREATE INDEX "LogisticsPurchaseOrder_supplierName_idx"
ON "LogisticsPurchaseOrder"("supplierName");
CREATE INDEX "LogisticsPurchaseOrder_userName_idx"
ON "LogisticsPurchaseOrder"("userName");
CREATE INDEX "LogisticsPurchaseOrder_projectName_idx"
ON "LogisticsPurchaseOrder"("projectName");
CREATE INDEX "LogisticsPurchaseOrder_updatedAt_idx"
ON "LogisticsPurchaseOrder"("updatedAt");

CREATE UNIQUE INDEX "LogisticsPurchaseOrderItem_purchaseOrderId_position_key"
ON "LogisticsPurchaseOrderItem"("purchaseOrderId", "position");
CREATE INDEX "LogisticsPurchaseOrderItem_purchaseOrderId_status_idx"
ON "LogisticsPurchaseOrderItem"("purchaseOrderId", "status");
CREATE INDEX "LogisticsPurchaseOrderItem_partName_idx"
ON "LogisticsPurchaseOrderItem"("partName");
CREATE INDEX "LogisticsPurchaseOrderItem_partNumber_idx"
ON "LogisticsPurchaseOrderItem"("partNumber");

CREATE UNIQUE INDEX "LogisticsReceipt_purchaseOrderItemId_deliveryNoteNumber_key"
ON "LogisticsReceipt"("purchaseOrderItemId", "deliveryNoteNumber");
CREATE INDEX "LogisticsReceipt_purchaseOrderItemId_receivedAt_idx"
ON "LogisticsReceipt"("purchaseOrderItemId", "receivedAt");
CREATE INDEX "LogisticsReceipt_deliveryNoteNumber_idx"
ON "LogisticsReceipt"("deliveryNoteNumber");

ALTER TABLE "LogisticsPurchaseOrderItem"
ADD CONSTRAINT "LogisticsPurchaseOrderItem_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "LogisticsPurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsReceipt"
ADD CONSTRAINT "LogisticsReceipt_purchaseOrderItemId_fkey"
FOREIGN KEY ("purchaseOrderItemId") REFERENCES "LogisticsPurchaseOrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
