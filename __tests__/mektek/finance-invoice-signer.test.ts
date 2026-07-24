import {
  FINANCE_INVOICE_SIGNERS,
  isFinanceInvoiceSigner,
} from "@/lib/mektek/finance-invoice-signers";

describe("Finance invoice signer selection", () => {
  it("only accepts the two approved authorized signers", () => {
    expect(FINANCE_INVOICE_SIGNERS).toEqual(["SUYADI", "WATI"]);
    expect(isFinanceInvoiceSigner("SUYADI")).toBe(true);
    expect(isFinanceInvoiceSigner("WATI")).toBe(true);
    expect(isFinanceInvoiceSigner("OTHER")).toBe(false);
  });
});
