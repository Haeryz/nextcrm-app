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

describe("Rekap Surat Jalan workbook fidelity", () => {
  it("uses the exact eleven columns from the Accounting workbook", () => {
    const headers = [
      "PERUSAHAAN",
      "NO SJ/BA",
      "TANGGAL SJ",
      "NOMER INVOICE",
      "TANGGAL INVOICE",
      "PO",
      "TANGGAL PO",
      "DESCRIPTION",
      "TOTAL",
      "PPN",
      "GRAND TOTAL",
    ];

    for (const header of headers) {
      expect(workspaceSource).toContain(`>${header}</th>`);
    }
    expect(workspaceSource).not.toContain('>Sumber</th>');
  });

  it("paginates the live invoice-derived delivery-note projection", () => {
    expect(workspaceSource).toContain(
      "const synchronizedReport = await getFinanceSynchronizedReport()",
    );
    expect(workspaceSource).toContain(
      "const matchingRows = synchronizedReport.deliveryNotes.filter",
    );
    expect(workspaceSource).toContain("const rows = matchingRows.slice(");
    expect(workspaceSource).toContain(
      "(currentDeliveryNotesPage - 1) * deliveryNotesPageSize",
    );
  });

  it("expands merged Excel cells before mapping a visual row", () => {
    expect(extractorSource).toContain("merged_cell_anchors");
    expect(extractorSource).toContain("expand_merged_values");
    expect(extractorSource).toContain(
      "values = expand_merged_values(",
    );
    expect(extractorSource).toContain(
      "if not any(clean(value) is not None for value in values):",
    );
    expect(extractorSource).not.toContain(
      "if not company or not delivery_number:",
    );
  });
});
