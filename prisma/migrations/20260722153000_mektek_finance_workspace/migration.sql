-- CreateEnum
CREATE TYPE "LogisticsPurchaseOrderMode" AS ENUM ('MANUAL', 'CONSIGNMENT');

-- CreateEnum
CREATE TYPE "FinanceSupplyReviewStatus" AS ENUM ('CLEAR', 'BLOCKED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "FinanceCounterpartyRole" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "FinanceContractType" AS ENUM ('SERVICE', 'SPARE_PART', 'RENTAL', 'CONSIGNMENT', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "FinanceQuoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FinanceSourceType" AS ENUM ('SERVICE_ORDER', 'OUTBOUND_DISPATCH', 'RECEIVING_PO', 'NON_PO_EXPENSE', 'BACKFILL');

-- CreateEnum
CREATE TYPE "FinanceSourceStatus" AS ENUM ('UNBILLED', 'DRAFTED', 'BILLED', 'CANCELLED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "FinanceInvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "FinanceSupplierBillStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "FinanceCashStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MIDTRANS', 'VIRTUAL_ACCOUNT', 'QRIS', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceApprovalAction" AS ENUM ('ISSUE_INVOICE', 'POST_SUPPLIER_BILL', 'APPROVE_QUOTE', 'POST_DISBURSEMENT', 'VOID_INVOICE', 'VOID_SUPPLIER_BILL', 'REVERSE_RECEIPT', 'REVERSE_DISBURSEMENT', 'OVERRIDE_SUPPLY_CONFLICT');

-- CreateEnum
CREATE TYPE "FinanceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinanceAttachmentKind" AS ENUM ('SIGNED_CONTRACT', 'QUOTE', 'INVOICE_SUPPORT', 'TAX_INVOICE', 'PAYMENT_PROOF', 'APPROVAL', 'SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "LogisticsPurchaseOrder" ADD COLUMN     "financeContractId" UUID,
ADD COLUMN     "financeCounterpartyId" UUID,
ADD COLUMN     "financeQuoteId" UUID,
ADD COLUMN     "poMode" "LogisticsPurchaseOrderMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "supplyEndDate" DATE,
ADD COLUMN     "supplyReviewStatus" "FinanceSupplyReviewStatus" NOT NULL DEFAULT 'CLEAR',
ADD COLUMN     "supplyStartDate" DATE;

-- AlterTable
ALTER TABLE "LogisticsPurchaseOrderItem" ADD COLUMN     "agreedUnitPrice" DECIMAL(18,2),
ADD COLUMN     "financeContractLineId" UUID,
ADD COLUMN     "financeQuoteLineId" UUID;

-- CreateTable
CREATE TABLE "FinanceCounterparty" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "role" "FinanceCounterpartyRole" NOT NULL,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "paymentTermsDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCounterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceContract" (
    "id" UUID NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "type" "FinanceContractType" NOT NULL,
    "status" "FinanceContractStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "projectName" TEXT,
    "siteName" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "contractValue" DECIMAL(18,2),
    "ownerId" UUID,
    "signedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceContractLine" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "partNumber" TEXT,
    "itemKey" TEXT NOT NULL,
    "contractedQuantity" INTEGER,
    "unitPrice" DECIMAL(18,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceQuote" (
    "id" UUID NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "status" "FinanceQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "projectName" TEXT,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "notes" TEXT,
    "createdBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceQuoteLine" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "partNumber" TEXT,
    "itemKey" TEXT NOT NULL,
    "quantity" INTEGER,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBillingSource" (
    "id" UUID NOT NULL,
    "sourceType" "FinanceSourceType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "contractId" UUID,
    "quoteId" UUID,
    "invoiceId" UUID,
    "status" "FinanceSourceStatus" NOT NULL DEFAULT 'UNBILLED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "taxProfile" TEXT NOT NULL DEFAULT 'NONE',
    "paymentTermsDays" INTEGER,
    "subtotal" DECIMAL(18,2),
    "taxAmount" DECIMAL(18,2),
    "withholdingAmount" DECIMAL(18,2),
    "totalAmount" DECIMAL(18,2),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBillingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvoice" (
    "id" UUID NOT NULL,
    "draftNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "counterpartyId" UUID NOT NULL,
    "contractId" UUID,
    "status" "FinanceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "invoiceDate" DATE,
    "dueDate" DATE,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingRate" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxInvoiceNumber" TEXT,
    "publicTokenHash" TEXT,
    "notes" TEXT,
    "requestedBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "sourceLineKey" TEXT,

    CONSTRAINT "FinanceInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceipt" (
    "id" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "status" "FinanceCashStatus" NOT NULL DEFAULT 'POSTED',
    "method" "FinancePaymentMethod" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bankReference" TEXT,
    "providerPaymentId" TEXT,
    "proofRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceiptAllocation" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayableSource" (
    "id" UUID NOT NULL,
    "sourceType" "FinanceSourceType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "supplierBillId" UUID,
    "status" "FinanceSourceStatus" NOT NULL DEFAULT 'UNBILLED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(18,2),
    "taxAmount" DECIMAL(18,2),
    "totalAmount" DECIMAL(18,2),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePayableSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSupplierBill" (
    "id" UUID NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "status" "FinanceSupplierBillStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "billDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expenseCategory" TEXT,
    "matchException" TEXT,
    "notes" TEXT,
    "requestedBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSupplierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSupplierBillLine" (
    "id" UUID NOT NULL,
    "supplierBillId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "sourceLineKey" TEXT,

    CONSTRAINT "FinanceSupplierBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDisbursement" (
    "id" UUID NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "status" "FinanceCashStatus" NOT NULL DEFAULT 'POSTED',
    "method" "FinancePaymentMethod" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "bankReference" TEXT,
    "notes" TEXT,
    "createdBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDisbursementAllocation" (
    "id" UUID NOT NULL,
    "disbursementId" UUID NOT NULL,
    "supplierBillId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDisbursementAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceApproval" (
    "id" UUID NOT NULL,
    "action" "FinanceApprovalAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "FinanceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAuditEvent" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" UUID,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAttachment" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" "FinanceAttachmentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReminderDelivery" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "milestoneDays" INTEGER NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" "FinanceReminderStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentSequence" (
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentSequence_pkey" PRIMARY KEY ("kind","periodKey")
);

-- CreateTable
CREATE TABLE "LogisticsSupplyAllocation" (
    "id" UUID NOT NULL,
    "purchaseOrderItemId" UUID NOT NULL,
    "counterpartyId" UUID NOT NULL,
    "projectKey" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "poMode" "LogisticsPurchaseOrderMode" NOT NULL,
    "supplyStartDate" DATE NOT NULL,
    "supplyEndDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "FinanceSupplyReviewStatus" NOT NULL DEFAULT 'CLEAR',
    "overrideApprovalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsSupplyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCounterparty_normalizedName_key" ON "FinanceCounterparty"("normalizedName");

-- CreateIndex
CREATE INDEX "FinanceCounterparty_role_isActive_idx" ON "FinanceCounterparty"("role", "isActive");

-- CreateIndex
CREATE INDEX "FinanceCounterparty_legalName_idx" ON "FinanceCounterparty"("legalName");

-- CreateIndex
CREATE INDEX "FinanceContract_status_endDate_idx" ON "FinanceContract"("status", "endDate");

-- CreateIndex
CREATE INDEX "FinanceContract_counterpartyId_startDate_endDate_idx" ON "FinanceContract"("counterpartyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceContract_counterpartyId_normalizedNumber_version_key" ON "FinanceContract"("counterpartyId", "normalizedNumber", "version");

-- CreateIndex
CREATE INDEX "FinanceContractLine_contractId_itemKey_idx" ON "FinanceContractLine"("contractId", "itemKey");

-- CreateIndex
CREATE INDEX "FinanceContractLine_catalogItemId_idx" ON "FinanceContractLine"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceContractLine_contractId_position_key" ON "FinanceContractLine"("contractId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceQuote_quoteNumber_key" ON "FinanceQuote"("quoteNumber");

-- CreateIndex
CREATE INDEX "FinanceQuote_counterpartyId_status_validUntil_idx" ON "FinanceQuote"("counterpartyId", "status", "validUntil");

-- CreateIndex
CREATE INDEX "FinanceQuoteLine_quoteId_itemKey_idx" ON "FinanceQuoteLine"("quoteId", "itemKey");

-- CreateIndex
CREATE INDEX "FinanceQuoteLine_catalogItemId_idx" ON "FinanceQuoteLine"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceQuoteLine_quoteId_position_key" ON "FinanceQuoteLine"("quoteId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBillingSource_sourceKey_key" ON "FinanceBillingSource"("sourceKey");

-- CreateIndex
CREATE INDEX "FinanceBillingSource_status_occurredAt_idx" ON "FinanceBillingSource"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "FinanceBillingSource_counterpartyId_status_idx" ON "FinanceBillingSource"("counterpartyId", "status");

-- CreateIndex
CREATE INDEX "FinanceBillingSource_invoiceId_idx" ON "FinanceBillingSource"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoice_draftNumber_key" ON "FinanceInvoice"("draftNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoice_invoiceNumber_key" ON "FinanceInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoice_publicTokenHash_key" ON "FinanceInvoice"("publicTokenHash");

-- CreateIndex
CREATE INDEX "FinanceInvoice_status_dueDate_idx" ON "FinanceInvoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "FinanceInvoice_counterpartyId_status_idx" ON "FinanceInvoice"("counterpartyId", "status");

-- CreateIndex
CREATE INDEX "FinanceInvoice_invoiceDate_idx" ON "FinanceInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "FinanceInvoiceLine_invoiceId_idx" ON "FinanceInvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvoiceLine_invoiceId_position_key" ON "FinanceInvoiceLine"("invoiceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_receiptNumber_key" ON "FinanceReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_providerPaymentId_key" ON "FinanceReceipt"("providerPaymentId");

-- CreateIndex
CREATE INDEX "FinanceReceipt_counterpartyId_receivedAt_idx" ON "FinanceReceipt"("counterpartyId", "receivedAt");

-- CreateIndex
CREATE INDEX "FinanceReceipt_status_receivedAt_idx" ON "FinanceReceipt"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "FinanceReceiptAllocation_invoiceId_idx" ON "FinanceReceiptAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceiptAllocation_receiptId_invoiceId_key" ON "FinanceReceiptAllocation"("receiptId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayableSource_sourceKey_key" ON "FinancePayableSource"("sourceKey");

-- CreateIndex
CREATE INDEX "FinancePayableSource_status_occurredAt_idx" ON "FinancePayableSource"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancePayableSource_counterpartyId_status_idx" ON "FinancePayableSource"("counterpartyId", "status");

-- CreateIndex
CREATE INDEX "FinancePayableSource_supplierBillId_idx" ON "FinancePayableSource"("supplierBillId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSupplierBill_internalNumber_key" ON "FinanceSupplierBill"("internalNumber");

-- CreateIndex
CREATE INDEX "FinanceSupplierBill_status_dueDate_idx" ON "FinanceSupplierBill"("status", "dueDate");

-- CreateIndex
CREATE INDEX "FinanceSupplierBill_counterpartyId_status_idx" ON "FinanceSupplierBill"("counterpartyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSupplierBill_counterpartyId_supplierInvoiceNumber_key" ON "FinanceSupplierBill"("counterpartyId", "supplierInvoiceNumber");

-- CreateIndex
CREATE INDEX "FinanceSupplierBillLine_supplierBillId_idx" ON "FinanceSupplierBillLine"("supplierBillId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSupplierBillLine_supplierBillId_position_key" ON "FinanceSupplierBillLine"("supplierBillId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDisbursement_paymentNumber_key" ON "FinanceDisbursement"("paymentNumber");

-- CreateIndex
CREATE INDEX "FinanceDisbursement_counterpartyId_paidAt_idx" ON "FinanceDisbursement"("counterpartyId", "paidAt");

-- CreateIndex
CREATE INDEX "FinanceDisbursement_status_paidAt_idx" ON "FinanceDisbursement"("status", "paidAt");

-- CreateIndex
CREATE INDEX "FinanceDisbursementAllocation_supplierBillId_idx" ON "FinanceDisbursementAllocation"("supplierBillId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDisbursementAllocation_disbursementId_supplierBillId_key" ON "FinanceDisbursementAllocation"("disbursementId", "supplierBillId");

-- CreateIndex
CREATE INDEX "FinanceApproval_status_requestedAt_idx" ON "FinanceApproval"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "FinanceApproval_entityType_entityId_idx" ON "FinanceApproval"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FinanceApproval_requestedBy_idx" ON "FinanceApproval"("requestedBy");

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_entityType_entityId_createdAt_idx" ON "FinanceAuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_actorId_createdAt_idx" ON "FinanceAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_action_createdAt_idx" ON "FinanceAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAttachment_entityType_entityId_createdAt_idx" ON "FinanceAttachment"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAttachment_sha256_idx" ON "FinanceAttachment"("sha256");

-- CreateIndex
CREATE INDEX "FinanceReminderDelivery_status_attemptedAt_idx" ON "FinanceReminderDelivery"("status", "attemptedAt");

-- CreateIndex
CREATE INDEX "FinanceReminderDelivery_recipientUserId_createdAt_idx" ON "FinanceReminderDelivery"("recipientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReminderDelivery_contractId_milestoneDays_recipientU_key" ON "FinanceReminderDelivery"("contractId", "milestoneDays", "recipientUserId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsSupplyAllocation_purchaseOrderItemId_key" ON "LogisticsSupplyAllocation"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "LogisticsSupplyAllocation_counterpartyId_projectKey_itemKey_idx" ON "LogisticsSupplyAllocation"("counterpartyId", "projectKey", "itemKey", "supplyStartDate", "supplyEndDate");

-- CreateIndex
CREATE INDEX "LogisticsSupplyAllocation_poMode_status_idx" ON "LogisticsSupplyAllocation"("poMode", "status");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrder_poMode_supplyReviewStatus_idx" ON "LogisticsPurchaseOrder"("poMode", "supplyReviewStatus");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrder_financeCounterpartyId_supplyStartDat_idx" ON "LogisticsPurchaseOrder"("financeCounterpartyId", "supplyStartDate", "supplyEndDate");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrder_financeContractId_idx" ON "LogisticsPurchaseOrder"("financeContractId");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrder_financeQuoteId_idx" ON "LogisticsPurchaseOrder"("financeQuoteId");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrderItem_financeContractLineId_idx" ON "LogisticsPurchaseOrderItem"("financeContractLineId");

-- CreateIndex
CREATE INDEX "LogisticsPurchaseOrderItem_financeQuoteLineId_idx" ON "LogisticsPurchaseOrderItem"("financeQuoteLineId");

-- AddForeignKey
ALTER TABLE "LogisticsPurchaseOrder" ADD CONSTRAINT "LogisticsPurchaseOrder_financeCounterpartyId_fkey" FOREIGN KEY ("financeCounterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsPurchaseOrder" ADD CONSTRAINT "LogisticsPurchaseOrder_financeContractId_fkey" FOREIGN KEY ("financeContractId") REFERENCES "FinanceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsPurchaseOrder" ADD CONSTRAINT "LogisticsPurchaseOrder_financeQuoteId_fkey" FOREIGN KEY ("financeQuoteId") REFERENCES "FinanceQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsPurchaseOrderItem" ADD CONSTRAINT "LogisticsPurchaseOrderItem_financeContractLineId_fkey" FOREIGN KEY ("financeContractLineId") REFERENCES "FinanceContractLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsPurchaseOrderItem" ADD CONSTRAINT "LogisticsPurchaseOrderItem_financeQuoteLineId_fkey" FOREIGN KEY ("financeQuoteLineId") REFERENCES "FinanceQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceContract" ADD CONSTRAINT "FinanceContract_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceContractLine" ADD CONSTRAINT "FinanceContractLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FinanceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuote" ADD CONSTRAINT "FinanceQuote_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuoteLine" ADD CONSTRAINT "FinanceQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "FinanceQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBillingSource" ADD CONSTRAINT "FinanceBillingSource_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBillingSource" ADD CONSTRAINT "FinanceBillingSource_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FinanceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBillingSource" ADD CONSTRAINT "FinanceBillingSource_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "FinanceQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBillingSource" ADD CONSTRAINT "FinanceBillingSource_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FinanceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoiceLine" ADD CONSTRAINT "FinanceInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptAllocation" ADD CONSTRAINT "FinanceReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FinanceReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptAllocation" ADD CONSTRAINT "FinanceReceiptAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayableSource" ADD CONSTRAINT "FinancePayableSource_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayableSource" ADD CONSTRAINT "FinancePayableSource_supplierBillId_fkey" FOREIGN KEY ("supplierBillId") REFERENCES "FinanceSupplierBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSupplierBill" ADD CONSTRAINT "FinanceSupplierBill_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSupplierBillLine" ADD CONSTRAINT "FinanceSupplierBillLine_supplierBillId_fkey" FOREIGN KEY ("supplierBillId") REFERENCES "FinanceSupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDisbursement" ADD CONSTRAINT "FinanceDisbursement_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDisbursementAllocation" ADD CONSTRAINT "FinanceDisbursementAllocation_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "FinanceDisbursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDisbursementAllocation" ADD CONSTRAINT "FinanceDisbursementAllocation_supplierBillId_fkey" FOREIGN KEY ("supplierBillId") REFERENCES "FinanceSupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReminderDelivery" ADD CONSTRAINT "FinanceReminderDelivery_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FinanceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsSupplyAllocation" ADD CONSTRAINT "LogisticsSupplyAllocation_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "LogisticsPurchaseOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsSupplyAllocation" ADD CONSTRAINT "LogisticsSupplyAllocation_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
