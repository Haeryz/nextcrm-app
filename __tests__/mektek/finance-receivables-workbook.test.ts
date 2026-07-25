import fs from "node:fs";
import path from "node:path";

const workspaceSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
  ),
  "utf8",
);

const extractorSource = fs.readFileSync(
  path.join(process.cwd(), "scripts/extract-accounting-demo.py"),
  "utf8",
);

const menuSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
  ),
  "utf8",
);

describe("Rekapitulasi invoice jasa & part workbook fidelity", () => {
  it("keeps the exact first and last columns from the main workbook table", () => {
    expect(workspaceSource).toContain(">No</th>");
    expect(workspaceSource).toContain(">Keterangan</th>");
    expect(extractorSource).toContain("max_col=18");
    expect(extractorSource).toContain('"number": number(values[0])');
    expect(extractorSource).toContain('"notes": text(values[17])');
    expect(extractorSource).not.toContain(
      'if not any([data["totalReceivable"], data["paid"], data["balance"]',
    );
  });

  it("renders all three transposed workbook report blocks", () => {
    expect(workspaceSource).toContain("Realisasi bulanan per perusahaan");
    expect(workspaceSource).toContain("Total per perusahaan");
    expect(workspaceSource).toContain("Total bulanan");
  });

  it("derives the recap from live invoices and posted payments", () => {
    expect(workspaceSource).toContain(
      "const synchronizedReport = await getFinanceSynchronizedReport()",
    );
    expect(workspaceSource).toContain(
      "const receivableRows = synchronizedReport.receivables.filter",
    );
    expect(workspaceSource).toContain('receipt: { status: "POSTED" }');
    expect(workspaceSource).not.toContain(
      'where: { sheetKey: "invoice_receivables" }',
    );
  });

  it("uses the worksheet purpose instead of calling it rekap piutang", () => {
    expect(menuSource).toContain("Rekapitulasi Invoice Jasa & Part");
    expect(menuSource).not.toContain("Rekap Piutang Invoice");
  });
});
