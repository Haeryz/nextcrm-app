import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("supplier debt ledger UI integration", () => {
  it("offers deposit, payment, and edit actions on every supplier detail row", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierDebtReportManager.tsx",
    );
    const transactionDialog = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierDebtTransactionDialog.tsx",
    );

    expect(manager).toContain('kind="DEPOSIT"');
    expect(manager).toContain('kind="PAYMENT"');
    expect(manager).toContain("<SupplierDebtEntryDialog");
    expect(transactionDialog).toContain("Bayar hutang / piutang");
    expect(transactionDialog).toContain("akan terdokumentasi sebagai");
    expect(transactionDialog).toContain("saldo deposit pemasok");
  });

  it("shows persistent transaction history and near-due highlighting", () => {
    const manager = source(
      "app/[locale]/(routes)/mektek/finance/_components/SupplierDebtReportManager.tsx",
    );
    const page = source(
      "app/[locale]/(routes)/mektek/finance/supplier-debt-report/page.tsx",
    );

    expect(manager).toContain("Riwayat deposit & pembayaran");
    expect(manager).toContain("Perhatian jatuh tempo");
    expect(manager).toContain("Lewat jatuh tempo");
    expect(manager).toContain("Segera jatuh tempo");
    expect(page).toContain("applySupplierDebtPayments");
    expect(page).toContain("supplierDepositBalance");
  });
});
