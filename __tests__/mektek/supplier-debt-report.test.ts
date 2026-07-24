import * as XLSX from "xlsx";

import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import { parseSupplierDebtEntryInput } from "@/lib/mektek/supplier-debt-entry";
import {
  extractSupplierDebtWorkbook,
  supplierDebtStatus,
  type SupplierDebtWorkbookReport,
} from "@/lib/mektek/supplier-debt-report";

const worksheet = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet(rows);

describe("Supplier debt report workbook contract", () => {
  it("preserves every supplied workbook sheet in the verified snapshot", () => {
    const report = snapshot.report as SupplierDebtWorkbookReport;

    expect(report.overview.rows).toHaveLength(31);
    expect(report.recap.entries).toHaveLength(172);
    expect(report.detailSheets).toHaveLength(31);
    expect(
      report.detailSheets.reduce(
        (total, sheet) => total + sheet.entries.length,
        0,
      ),
    ).toBe(701);
    expect(report.detailSheets[0]).toMatchObject({
      sheetKey: "REKAP HUTANG LOKAL",
      entries: [],
    });
    expect(
      report.detailSheets
        .find((sheet) => sheet.sheetKey === "ALVINDO")
        ?.entries.reduce((total, row) => total + row.grandTotal, 0),
    ).toBe(57_317_000);
    expect(report.detailSheets.at(-1)?.sheetKey).toBe("VARIASI AC");
  });

  it("separates the two recap sheets from the detail sheets", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet([
        [],
        [],
        [],
        [],
        [],
        ["REKAP HUTANG : INVESTASI, OPERASIONAL & PARTS"],
        ["JANUARI S/D DESEMBER 2026"],
        [null, null, null, null, null, null, null, "UPDATE : 06/07/2026"],
        [
          "No",
          "NAMA",
          "PIC",
          "ALAMAT",
          "SISA HUTANG",
          "SISA PIUTANG",
          "HARI",
          "Tag Jatuh Tempo",
          "CATATAN",
          "NO RINCIAN",
          "RINCIAN",
        ],
        [1, "Supplier A", "Budi", "JKT", 120_000, 10_000, 30, 50_000, "Juli", 1, 50_000],
      ]),
      "T. HUT. ALL SUPPLIER",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet([
        [],
        [],
        [],
        [],
        [
          "NO",
          "NAMA SUPPLIER",
          "TANGGAL INVOICE",
          "NOMOR NOTA / INVOICE",
          "NOMINAL",
          "ACTUAL PEMBAYARAN",
          "TOTAL PEMBAYARAN",
          "BULAN KE",
          "BULAN KE",
          "PEMBELIAN (P)",
          "HUTANG USAHA (H.U)",
        ],
        [1, "Supplier A", new Date("2026-01-10"), "INV-1", 120_000, new Date("2026-02-10"), 40_000, null, 2, "P", "H.U"],
      ]),
      "REKAP HUTANG SUPPLIER",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet([
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [null, "REKAP HUTANG : SUPPLIER A", null, null, null, null, null, null, "NO REK : 123"],
        [null, "PIC : Budi, TOP : N30", null, null, null, null, null, null, "AN : Supplier A"],
        [null, "HP : 0812", null, null, null, null, null, null, "BANK : BCA"],
        [null, "Januari S/D Desember 2026"],
        [],
        [
          "NO",
          "TANGGAL PO",
          "NOMOR PO",
          "TANGGAL TERIMA BARANG",
          "DITERIMA OLEH",
          "NOMOR SJ",
          "TANGGAL INV/NOTA",
          "NOMOR NOTA",
          "NOMOR FP",
          "TGL JATUH TEMPO",
          null,
          "PART NUMBER",
          "DESKRIPSI",
          "QTY",
          "HARGA",
          "JUMLAH",
          "GRAND TOTAL",
          "DATE IN PART",
          "TANGGAL",
          "NOMINAL",
          "TANGGAL",
          "KODE AKUN K/D",
        ],
        [],
        [1, new Date("2026-01-01"), "PO-1", null, null, "SJ-1", new Date("2026-01-10"), "INV-1", "FP-1", new Date("2026-02-09"), null, "PART-1", "Kompresor", 1, 120_000, 120_000, 120_000, null, new Date("2026-02-10"), 40_000, null, "Hutang Usaha"],
      ]),
      "SUPPLIER A",
    );

    const report = extractSupplierDebtWorkbook(workbook);

    expect(report.overview.rows[0]).toMatchObject({
      supplierName: "Supplier A",
      remainingDebt: 120_000,
      remainingReceivable: 10_000,
      paymentTermDays: 30,
      dueAmount: 50_000,
      breakdown: [50_000],
    });
    expect(report.recap.entries[0]).toMatchObject({
      supplierName: "Supplier A",
      invoiceNumber: "INV-1",
      nominal: 120_000,
      totalPayment: 40_000,
      monthNumber: 2,
      accountCategory: "H.U",
    });
    expect(report.detailSheets[0]).toMatchObject({
      sheetKey: "SUPPLIER A",
      supplierName: "SUPPLIER A",
      contactName: "Budi",
      paymentTermDays: 30,
      bankAccount: "123",
      bankAccountName: "Supplier A",
      bankName: "BCA",
    });
    expect(report.detailSheets[0].entries[0]).toMatchObject({
      purchaseOrderNumber: "PO-1",
      deliveryNoteNumber: "SJ-1",
      invoiceNumber: "INV-1",
      taxInvoiceNumber: "FP-1",
      description: "Kompresor",
      grandTotal: 120_000,
      paymentAmount: 40_000,
    });
  });
});

describe("Supplier debt status", () => {
  it("classifies unpaid, partial, and paid balances", () => {
    expect(supplierDebtStatus(100, 0)).toBe("BELUM_BAYAR");
    expect(supplierDebtStatus(100, 40)).toBe("CICILAN");
    expect(supplierDebtStatus(100, 100)).toBe("LUNAS");
  });
});

describe("Supplier debt manual row input", () => {
  it("calculates amount and grand total when the user leaves them empty", () => {
    const result = parseSupplierDebtEntryInput({
      sheetKey: "ALVINDO",
      purchaseOrderNumber: "PO-2026-001",
      deliveryNoteNumber: "SJ-2026-001",
      description: "Kompresor",
      quantity: "2",
      unitPrice: "150000",
      paymentAmount: "50000",
      invoiceDate: "2026-07-24",
    });

    expect(result).not.toHaveProperty("error");
    if ("data" in result && result.data) {
      expect(result.data.amount.toNumber()).toBe(300_000);
      expect(result.data.grandTotal.toNumber()).toBe(300_000);
      expect(result.data.paymentAmount.toNumber()).toBe(50_000);
    }
  });

  it("requires a PO, delivery note, or invoice reference", () => {
    expect(
      parseSupplierDebtEntryInput({
        sheetKey: "ALVINDO",
        description: "Kompresor",
        quantity: 1,
        unitPrice: 100_000,
      }),
    ).toEqual({
      error: "Isi minimal Nomor PO, Nomor SJ, atau Nomor invoice",
    });
  });

  it("rejects payment above the row grand total", () => {
    expect(
      parseSupplierDebtEntryInput({
        sheetKey: "ALVINDO",
        invoiceNumber: "INV-OVERPAY",
        description: "Kompresor",
        quantity: 1,
        unitPrice: 100_000,
        paymentAmount: 120_000,
      }),
    ).toEqual({
      error: "Nominal bayar tidak boleh melebihi grand total",
    });
  });
});
