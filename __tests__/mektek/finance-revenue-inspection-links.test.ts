import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Finance revenue classification inspection links", () => {
  it("links each unclear revenue description to the affected invoice", () => {
    const workspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );
    const parts = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspaceParts.tsx",
    );

    expect(workspace).toContain("unclassifiedInvoices");
    expect(parts).toContain("Deskripsi perlu diperiksa");
    expect(parts).toContain("classification=unclassified&inspect=");
    expect(parts).toContain("Periksa semua");
  });

  it("supports the unclassified invoice filter and direct inspection target", () => {
    const page = read(
      "app/[locale]/(routes)/mektek/finance/invoices/page.tsx",
    );
    const workspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );
    const manager = read(
      "app/[locale]/(routes)/mektek/finance/_components/InvoiceCrudManager.tsx",
    );

    expect(page).toContain("classification");
    expect(page).toContain("inspect");
    expect(workspace).toContain('classification === "unclassified"');
    expect(manager).toContain("initialInvoiceId");
    expect(manager).toContain("initialInvoice");
    expect(manager).toContain("Baris invoice yang perlu diperiksa");
  });
});
