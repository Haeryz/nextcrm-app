import { readFileSync } from "fs";
import { resolve } from "path";

import { buildFinanceSynchronizedRecaps } from "@/lib/mektek/finance-recaps";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const invoice = {
  id: "invoice-1",
  invoiceNumber: "INV-001",
  draftNumber: "draft-0001",
  status: "ISSUED",
  customer: "PT Maju Jaya",
  invoiceDate: "2026-07-22",
  deliveryNoteNumber: "SJ-001",
  deliveryNoteDate: "2026-07-20",
  receiptNumber: null,
  purchaseOrderNumber: "123/PO/VII/2026",
  purchaseOrderDate: "2026-07-10",
  taxInvoiceNumber: null,
  subtotal: 450_000,
  taxAmount: 49_500,
  netAmount: 499_500,
  paidAmount: 0,
  lines: [
    { kind: "SPARE_PART", description: "Filter oli", lineTotal: 300_000 },
    { kind: "SERVICE", description: "Jasa servis mesin", lineTotal: 150_000 },
  ],
  deliveryNotes: [],
};

describe("Finance recap CRUD", () => {
  it("carries the source invoice id on every recap row", () => {
    const report = buildFinanceSynchronizedRecaps([invoice]);

    expect(report.deliveryNotes).toHaveLength(1);
    expect(report.deliveryNotes[0].invoiceId).toBe("invoice-1");
    expect(report.revenueRows.length).toBeGreaterThan(0);
    for (const row of report.revenueRows) {
      expect(row.invoiceId).toBe("invoice-1");
    }
  });

  it("splits a mixed invoice into a jasa and a spare part row", () => {
    const report = buildFinanceSynchronizedRecaps([invoice]);
    const categories = report.revenueRows.map((row) => row.category).sort();

    expect(categories).toEqual(["service", "sparepart"]);
  });

  it("exposes row actions on the recaps derived from an invoice", () => {
    const workspace = read(
      "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
    );

    // Rekap surat jalan, Pendapatan spare part and Pendapatan jasa each get
    // per-row edit and delete.
    expect(workspace.match(/<RecapRowActions/g)).toHaveLength(3);
    // Every recap page from surat jalan through rekap jasa & part can create.
    expect(workspace.match(/<RecapCreateButton \/>/g)).toHaveLength(5);
  });

  it("edits through the invoice dialog and guards the delete", () => {
    const actions = read(
      "app/[locale]/(routes)/mektek/finance/_components/RecapRowActions.tsx",
    );

    expect(actions).toContain("../invoices?inspect=");
    expect(actions).toContain("deleteFinanceInvoiceEntry");
    expect(actions).toContain("window.confirm");
    expect(actions).toContain("router.refresh()");
  });

  it("keeps the recap action copy in Bahasa Indonesia", () => {
    const actions = read(
      "app/[locale]/(routes)/mektek/finance/_components/RecapRowActions.tsx",
    );
    const create = read(
      "app/[locale]/(routes)/mektek/finance/_components/RecapCreateButton.tsx",
    );

    expect(actions).toContain("Ubah");
    expect(actions).toContain("Hapus");
    expect(create).toContain("Tambah invoice");
  });
});
