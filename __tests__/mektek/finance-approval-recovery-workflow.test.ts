import fs from "node:fs";
import path from "node:path";

const resolve = (relativePath: string) =>
  path.resolve(process.cwd(), relativePath);

const read = (relativePath: string) =>
  fs.readFileSync(resolve(relativePath), "utf8");

describe("single-operator supplier finance workflow", () => {
  it("removes the approval page, menu, and submit-for-approval controls", () => {
    const menu = read(
      "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
    );
    const supplierPayments = read(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const paymentDialog = read(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierBillPaymentDialog.tsx",
    );
    const auditWorkspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );

    expect(
      fs.existsSync(
        resolve("app/[locale]/(routes)/mektek/finance/approvals/page.tsx"),
      ),
    ).toBe(false);
    expect(menu).not.toContain("/mektek/finance/approvals");
    expect(menu).not.toContain('{ title: "Persetujuan"');
    expect(supplierPayments).not.toContain(
      "submitFinanceSupplierBillForApproval",
    );
    expect(supplierPayments).not.toContain('PENDING_APPROVAL: "Menunggu persetujuan"');
    expect(supplierPayments).not.toContain("Ajukan");
    expect(supplierPayments).toContain("Siap dibayar");
    expect(paymentDialog).toContain("Catat pembayaran");
    expect(auditWorkspace).toContain("Arsip persetujuan lama");
    expect(auditWorkspace).not.toContain("FinanceApprovalCard");
  });

  it("posts a fully matched supplier bill immediately with an audit trail", () => {
    const actions = read("actions/mektek/finance.ts");

    expect(actions).not.toContain(
      "export async function submitFinanceSupplierBillForApproval",
    );
    expect(actions).toContain('status: "POSTED"');
    expect(actions).toContain('postedAt: new Date()');
    expect(actions).toContain('data: { supplierBillId: created.id, status: "BILLED" }');
    expect(actions).toContain('action: "POST_THREE_WAY_MATCHED_BILL"');
  });

  it("posts supplier payments directly while preventing overpayment", () => {
    const actions = read("actions/mektek/finance.ts");
    const supplierPayments = read(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierPaymentManager.tsx",
    );
    const paymentDialog = read(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierBillPaymentDialog.tsx",
    );

    expect(actions).toContain("export async function postFinanceDisbursement");
    expect(actions).not.toContain("export async function requestFinanceDisbursement");
    expect(actions).toContain('throw new Error("OVER_ALLOCATION")');
    expect(actions).toContain('? "PAID"');
    expect(actions).toContain(': "PARTIALLY_PAID"');
    expect(actions).toContain('entityType: "DISBURSEMENT"');
    expect(actions).toContain('action: "POST"');
    expect(supplierPayments).not.toContain("SupplierBillPaymentDialog");
    expect(supplierPayments).toContain("supplier-debt-report");
    expect(paymentDialog).toContain("postFinanceDisbursement");
    expect(paymentDialog).toContain("bankReference");
    expect(paymentDialog).toContain("Tanggal pembayaran");
    expect(paymentDialog).toContain("Metode pembayaran");
    expect(paymentDialog).toContain("Referensi pembayaran");
  });

  it("filters the payables register to exclude debt-ledger LUNAS bills", () => {
    const page = read(
      "app/[locale]/(routes)/mektek/finance/payables/page.tsx",
    );

    expect(page).toContain("applySupplierDebtPayments");
    expect(page).toContain("normalizeFinanceKey");
    expect(page).toContain("mektekSupplierDebtEntry");
    expect(page).toContain("mektekSupplierDebtTransaction");
    expect(page).toContain("lunasInvoiceKeys");
    expect(page).toContain('"PAID"');
    expect(page).toContain('"VOID"');
  });

  it("does not create or enforce Finance approvals for supply overlaps", () => {
    const logistics = read("actions/mektek/logistics.ts");
    const migration = read(
      "prisma/migrations/20260814150000_disable_supply_conflict_finance_approval/migration.sql",
    );

    expect(logistics).not.toContain('action: "OVERRIDE_SUPPLY_CONFLICT"');
    expect(logistics).not.toContain(
      "overlap supply Manual/Consignment menunggu approval Finance",
    );
    expect(logistics).toContain('supplyReviewStatus: "CLEAR"');
    expect(migration).toContain("OVERRIDE_SUPPLY_CONFLICT");
    expect(migration).toContain("POST_SUPPLIER_BILL");
    expect(migration).toContain("POST_DISBURSEMENT");
    expect(migration).toContain("CANCELLED");
    expect(migration).toContain("'DRAFT', 'PENDING_APPROVAL'");
    expect(migration).toContain('"supplyReviewStatus" = \'CLEAR\'');
  });

  it("keeps the idempotent VPS recovery script", () => {
    const script = read("scripts/repair-variation-asun-payable.ts");

    expect(script).toContain('supplierInvoiceNumber: "MTL0708261"');
    expect(script).toContain('const TARGET_SHEET_KEY = "VARIASI AC"');
    expect(script).toContain("--paid-at=YYYY-MM-DD");
    expect(script).toContain("--method=BANK_TRANSFER");
    expect(script).toContain("--reference=REFERENSI");
    expect(script).toContain("const commit = process.argv.includes(\"--commit\")");
    expect(script).toContain("dueDate: bill.billDate");
    expect(script).toContain("financeDisbursement.create");
    expect(script).toContain('status: "PAID"');
    expect(script).toContain("mektekSupplierDebtEntry.upsert");
  });
});
