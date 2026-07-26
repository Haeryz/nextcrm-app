-- Performance indexes.
--
-- Every index below backs a query that today has no usable index path. Written as plain
-- `CREATE INDEX` (not CONCURRENTLY) because Prisma wraps each migration in a transaction and
-- CONCURRENTLY cannot run inside one; there is no precedent for splitting that in this repo.
-- Each statement therefore takes a brief ACCESS EXCLUSIVE lock (blocks writes, not reads) on
-- its table. All targeted tables are small finance tables, so the lock window is short.
-- `IF NOT EXISTS` keeps this re-runnable if an index was created by hand first.

-- FinanceContract.supersedesId: renewal-chain lookups.
--   actions/mektek/finance.ts       -> findFirst({ where: { supersedesId: existing.id } })
--   FinanceWorkspace.tsx (contracts) -> findMany({ where: { supersedesId: { in: contractIds } } })
-- No existing index leads with this column.
CREATE INDEX IF NOT EXISTS "FinanceContract_supersedesId_idx"
ON "FinanceContract"("supersedesId");

-- FinanceAuditEvent.createdAt: FinanceWorkspace.tsx
--   findMany({ orderBy: { createdAt: "desc" }, take: 100 }) with no where.
-- createdAt is only ever a trailing column of a composite index, which Postgres cannot use
-- to satisfy an unfiltered ORDER BY.
CREATE INDEX IF NOT EXISTS "FinanceAuditEvent_createdAt_idx"
ON "FinanceAuditEvent"("createdAt");

-- FinanceApproval.requestedAt: FinanceWorkspace.tsx
--   findMany({ orderBy: { requestedAt: "desc" }, take: 50 }) with no where.
-- ("status", "requestedAt") cannot drive the sort without a "status" predicate.
CREATE INDEX IF NOT EXISTS "FinanceApproval_requestedAt_idx"
ON "FinanceApproval"("requestedAt");

-- FinanceReceipt.receivedAt: FinanceWorkspace.tsx (cash section)
--   findMany({ orderBy: { receivedAt: "desc" }, take: 50 }) with no where.
CREATE INDEX IF NOT EXISTS "FinanceReceipt_receivedAt_idx"
ON "FinanceReceipt"("receivedAt");

-- FinanceDisbursement.paidAt: FinanceWorkspace.tsx (cash section)
--   findMany({ orderBy: { paidAt: "desc" }, take: 50 }) with no where.
CREATE INDEX IF NOT EXISTS "FinanceDisbursement_paidAt_idx"
ON "FinanceDisbursement"("paidAt");

-- FinanceSupplierBill.createdAt: FinanceWorkspace.tsx (payables section)
--   findMany({ orderBy: { createdAt: "desc" }, take: 100 }) with no where.
CREATE INDEX IF NOT EXISTS "FinanceSupplierBill_createdAt_idx"
ON "FinanceSupplierBill"("createdAt");

-- FinanceSupplierBill (billDate, createdAt): mektek/finance/payables/page.tsx
--   findMany({ orderBy: [{ billDate: "desc" }, { createdAt: "desc" }], take: 200 }) with no where.
-- An ascending composite is scanned backwards to satisfy both DESC keys in one pass.
CREATE INDEX IF NOT EXISTS "FinanceSupplierBill_billDate_createdAt_idx"
ON "FinanceSupplierBill"("billDate", "createdAt");
