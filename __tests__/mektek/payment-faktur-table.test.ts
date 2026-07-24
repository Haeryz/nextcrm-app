import {
  filterAndSortPaymentFakturRows,
  paymentFakturDisplayNumber,
} from "@/lib/mektek/payment-faktur-table";

const rows = [
  {
    id: "late",
    sourceRow: 17,
    invoiceNumber: "ATL-003",
    invoiceDate: "2026-06-29",
    grandTotal: 20_000,
    paidAmount: 0,
    remainingAmount: 20_000,
    status: "BELUM_BAYAR" as const,
  },
  {
    id: "first",
    sourceRow: 15,
    invoiceNumber: "ATL-001",
    invoiceDate: "2026-06-01",
    grandTotal: 30_000,
    paidAmount: 30_000,
    remainingAmount: 0,
    status: "LUNAS" as const,
  },
  {
    id: "middle",
    sourceRow: 16,
    invoiceNumber: "ATL-002",
    invoiceDate: "2026-06-15",
    grandTotal: 25_000,
    paidAmount: 10_000,
    remainingAmount: 15_000,
    status: "CICILAN" as const,
  },
];

describe("Payment Faktur table controls", () => {
  it("filters by calculated payment status", () => {
    expect(
      filterAndSortPaymentFakturRows(rows, {
        status: "CICILAN",
        sort: "number",
        direction: "asc",
      }).map((row) => row.id),
    ).toEqual(["middle"]);
  });

  it("sorts ascending and descending without changing the source array", () => {
    expect(
      filterAndSortPaymentFakturRows(rows, {
        status: "SEMUA",
        sort: "grandTotal",
        direction: "desc",
      }).map((row) => row.id),
    ).toEqual(["first", "middle", "late"]);
    expect(rows.map((row) => row.id)).toEqual(["late", "first", "middle"]);
  });

  it("keeps workbook-style numbering for new rows in a customer sheet", () => {
    expect(paymentFakturDisplayNumber(17, 0, 0)).toBe(3);
    expect(paymentFakturDisplayNumber(null, 2, 50)).toBe(53);
  });
});
