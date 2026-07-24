CREATE TYPE "LogisticsReceivingDeliveryNoteSource" AS ENUM ('SUPPLIER', 'MEKTEK');

ALTER TABLE "LogisticsPurchaseOrder"
ADD COLUMN "receivingDeliveryNoteSource" "LogisticsReceivingDeliveryNoteSource";
