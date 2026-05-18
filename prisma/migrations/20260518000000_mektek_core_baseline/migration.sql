-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "taskStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "MektekStaffRole" AS ENUM ('CS', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "CatalogServiceLinkSource" AS ENUM ('ADMIN_ASSIGN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('cz', 'en', 'de', 'uk');

-- CreateTable
CREATE TABLE "Users" (
    "id" UUID NOT NULL,
    "__v" INTEGER NOT NULL DEFAULT 0,
    "account_name" TEXT,
    "avatar" TEXT,
    "email" TEXT NOT NULL,
    "is_account_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "mektekRole" "MektekStaffRole",
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "name" TEXT,
    "password" TEXT,
    "username" TEXT,
    "userStatus" "ActiveStatus" NOT NULL DEFAULT 'PENDING',
    "userLanguage" "Language" NOT NULL DEFAULT 'en',

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_Accounts_Tasks" (
    "id" UUID NOT NULL,
    "__v" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3),
    "updatedBy" UUID,
    "dueDateAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL,
    "tags" JSONB,
    "title" TEXT NOT NULL,
    "likes" BIGINT DEFAULT 0,
    "user" UUID,
    "taskStatus" "taskStatus" DEFAULT 'ACTIVE',

    CONSTRAINT "crm_Accounts_Tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasksComments" (
    "id" UUID NOT NULL,
    "__v" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task" UUID NOT NULL,
    "user" UUID NOT NULL,
    "assigned_crm_account_task" UUID,

    CONSTRAINT "tasksComments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCustomer" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "illustration" TEXT,
    "partNumber" TEXT,
    "catalogPartNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" TEXT,
    "price" INTEGER,
    "remark" TEXT,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogServiceLink" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "source" "CatalogServiceLinkSource" NOT NULL,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogServiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_email_idx" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_userStatus_idx" ON "Users"("userStatus");

-- CreateIndex
CREATE INDEX "Users_userLanguage_idx" ON "Users"("userLanguage");

-- CreateIndex
CREATE INDEX "Users_is_admin_idx" ON "Users"("is_admin");

-- CreateIndex
CREATE INDEX "Users_is_account_admin_idx" ON "Users"("is_account_admin");

-- CreateIndex
CREATE INDEX "Users_mektekRole_idx" ON "Users"("mektekRole");

-- CreateIndex
CREATE INDEX "Users_created_on_idx" ON "Users"("created_on");

-- CreateIndex
CREATE INDEX "Users_lastLoginAt_idx" ON "Users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_user_idx" ON "crm_Accounts_Tasks"("user");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_createdBy_idx" ON "crm_Accounts_Tasks"("createdBy");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_updatedBy_idx" ON "crm_Accounts_Tasks"("updatedBy");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_priority_idx" ON "crm_Accounts_Tasks"("priority");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_taskStatus_idx" ON "crm_Accounts_Tasks"("taskStatus");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_dueDateAt_idx" ON "crm_Accounts_Tasks"("dueDateAt");

-- CreateIndex
CREATE INDEX "crm_Accounts_Tasks_createdAt_idx" ON "crm_Accounts_Tasks"("createdAt");

-- CreateIndex
CREATE INDEX "tasksComments_task_idx" ON "tasksComments"("task");

-- CreateIndex
CREATE INDEX "tasksComments_user_idx" ON "tasksComments"("user");

-- CreateIndex
CREATE INDEX "tasksComments_assigned_crm_account_task_idx" ON "tasksComments"("assigned_crm_account_task");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCustomer_phoneNormalized_key" ON "CatalogCustomer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "CatalogCustomer_phoneNormalized_idx" ON "CatalogCustomer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "CatalogCustomer_createdAt_idx" ON "CatalogCustomer"("createdAt");

-- CreateIndex
CREATE INDEX "CatalogItem_machine_idx" ON "CatalogItem"("machine");

-- CreateIndex
CREATE INDEX "CatalogItem_description_idx" ON "CatalogItem"("description");

-- CreateIndex
CREATE INDEX "CatalogServiceLink_customerId_idx" ON "CatalogServiceLink"("customerId");

-- CreateIndex
CREATE INDEX "CatalogServiceLink_serviceOrderId_idx" ON "CatalogServiceLink"("serviceOrderId");

-- CreateIndex
CREATE INDEX "CatalogServiceLink_source_idx" ON "CatalogServiceLink"("source");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogServiceLink_customerId_serviceOrderId_key" ON "CatalogServiceLink"("customerId", "serviceOrderId");

-- AddForeignKey
ALTER TABLE "crm_Accounts_Tasks" ADD CONSTRAINT "crm_Accounts_Tasks_user_fkey" FOREIGN KEY ("user") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasksComments" ADD CONSTRAINT "tasksComments_assigned_crm_account_task_fkey" FOREIGN KEY ("assigned_crm_account_task") REFERENCES "crm_Accounts_Tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasksComments" ADD CONSTRAINT "tasksComments_user_fkey" FOREIGN KEY ("user") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogServiceLink" ADD CONSTRAINT "CatalogServiceLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CatalogCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogServiceLink" ADD CONSTRAINT "CatalogServiceLink_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "crm_Accounts_Tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
