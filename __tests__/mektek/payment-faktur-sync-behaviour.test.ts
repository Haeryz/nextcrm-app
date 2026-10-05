import { Prisma } from "@prisma/client";

import {
  removeInvoiceFromPaymentFaktur,
  syncInvoiceToPaymentFaktur,
} from "@/lib/mektek/payment-faktur-sync";

type Row = {
  id: string;
  customerId: string;
  invoiceNumber: string;
  sourceRow: number | null;
  grandTotal: Prisma.Decimal;
  transferDate: Date | null;
  installment1: Prisma.Decimal;
  installment2: Prisma.Decimal;
  installment3: Prisma.Decimal;
  createdAt: Date;
};

const d = (value: number) => new Prisma.Decimal(value);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function fakeTx(customers: { id: string; customerName: string }[], rows: Row[]) {
  let seq = 0;
  const matches = (row: Row, where: Record<string, any> = {}) =>
    (!where.id?.not || row.id !== where.id.not) &&
    (!where.id?.in || where.id.in.includes(row.id)) &&
    (!where.customerId || row.customerId === where.customerId) &&
    (!where.invoiceNumber || same(row.invoiceNumber, where.invoiceNumber.equals)) &&
    (!where.sourceRow || row.sourceRow !== null);
  const withCustomer = (row: Row) => ({
    ...row,
    customer: customers.find((c) => c.id === row.customerId)!,
  });
  const tx = {
    paymentFakturCustomer: {
      findFirst: async ({ where }: any) =>
        customers.find((c) => same(c.customerName, where.customerName.equals)) ?? null,
      findUnique: async () => null,
      create: async ({ data }: any) => {
        const created = { id: `c${++seq}`, customerName: data.customerName };
        customers.push(created);
        return created;
      },
    },
    paymentFakturEntry: {
      findFirst: async ({ where, orderBy }: any) => {
        const found = rows.filter((row) => matches(row, where));
        if (orderBy?.sourceRow) found.sort((a, b) => (b.sourceRow ?? 0) - (a.sourceRow ?? 0));
        return found[0] ?? null;
      },
      findMany: async ({ where }: any) => rows.filter((row) => matches(row, where)).map(withCustomer),
      update: async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return { id: row.id };
      },
      create: async ({ data }: any) => {
        const row = {
          id: `e${++seq}`,
          transferDate: null,
          installment1: d(0),
          installment2: d(0),
          installment3: d(0),
          createdAt: new Date(),
          ...data,
        };
        rows.push(row);
        return { id: row.id };
      },
      deleteMany: async ({ where }: any) => {
        for (const id of where.id.in) rows.splice(rows.findIndex((r) => r.id === id), 1);
      },
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

const row = (overrides: Partial<Row>): Row => ({
  id: "old",
  customerId: "bib",
  invoiceNumber: "MTL0191126",
  sourceRow: 15,
  grandTotal: d(1373070),
  transferDate: null,
  installment1: d(0),
  installment2: d(0),
  installment3: d(0),
  createdAt: new Date(0),
  ...overrides,
});

const snapshot = {
  customerName: "PT. Putra Perkasa Abadi - BIB",
  invoiceNumber: "MTL0191126",
  invoiceDate: null,
  receiptNumber: null,
  purchaseOrderNumber: null,
  destinationBank: null,
  deliveryDate: null,
  description: "SPARE PART EXPANTION VALVE",
  subtotal: d(1237000),
  taxAmount: d(136070),
  taxInvoiceNumber: null,
};

describe("syncInvoiceToPaymentFaktur on edit", () => {
  const customers = () => [
    { id: "bib", customerName: "BIB" },
    { id: "ppa", customerName: "PT. Putra Perkasa Abadi - BIB" },
  ];

  it("moves the row when the invoice's customer changes instead of duplicating it", async () => {
    const rows = [row({})];
    await syncInvoiceToPaymentFaktur(fakeTx(customers(), rows), snapshot, "u1", {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "old", customerId: "ppa", sourceRow: 15 });
  });

  it("keeps recorded installments when moving the row", async () => {
    const rows = [row({ installment1: d(500000) })];
    await syncInvoiceToPaymentFaktur(fakeTx(customers(), rows), snapshot, "u1", {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].installment1.toNumber()).toBe(500000);
  });

  it("drops an unpaid stale copy when the new customer already has the row", async () => {
    const rows = [row({}), row({ id: "new", customerId: "ppa" })];
    await syncInvoiceToPaymentFaktur(fakeTx(customers(), rows), snapshot, "u1", {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(rows.map((r) => r.id)).toEqual(["new"]);
  });

  it("follows an invoice-number change within the same customer", async () => {
    const rows = [row({ customerId: "ppa", invoiceNumber: "MTL-OLD" })];
    await syncInvoiceToPaymentFaktur(fakeTx(customers(), rows), snapshot, "u1", {
      invoiceNumber: "MTL-OLD",
      customerNormalizedName: "PT-PUTRA-PERKASA-ABADI-BIB",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "old", invoiceNumber: "MTL0191126", sourceRow: 15 });
  });

  it("leaves other customers' rows with the same number alone", async () => {
    const rows = [row({ customerId: "other" })];
    const tx = fakeTx([...customers(), { id: "other", customerName: "PT LAIN" }], rows);
    await syncInvoiceToPaymentFaktur(tx, snapshot, "u1", {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(rows.map((r) => r.customerId).sort()).toEqual(["other", "ppa"]);
  });
});

describe("removeInvoiceFromPaymentFaktur", () => {
  it("removes the unpaid mirror and keeps a paid one", async () => {
    const unpaid = [row({})];
    await removeInvoiceFromPaymentFaktur(fakeTx([{ id: "bib", customerName: "BIB" }], unpaid), {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(unpaid).toHaveLength(0);

    const paid = [row({ transferDate: new Date() })];
    await removeInvoiceFromPaymentFaktur(fakeTx([{ id: "bib", customerName: "BIB" }], paid), {
      invoiceNumber: "MTL0191126",
      customerNormalizedName: "BIB",
    });
    expect(paid).toHaveLength(1);
  });
});
