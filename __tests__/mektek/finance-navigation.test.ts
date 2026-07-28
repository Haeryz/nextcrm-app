import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Finance navigation hierarchy", () => {
  const menu = source(
    "app/[locale]/(routes)/components/menu-items/Mektek.tsx",
  );
  const navigation = source(
    "app/[locale]/(routes)/components/nav-main.tsx",
  );
  const paymentPage = source(
    "app/[locale]/(routes)/mektek/finance/payment-faktur/page.tsx",
  );

  it("groups every existing finance destination inside the localized sections", () => {
    expect(menu).toContain('title: "Keuangan"');
    expect(menu).toContain('title: "Akuntansi"');
    expect(menu).toContain(
      '{ title: "Ringkasan", url: "/mektek/finance", exact: true }',
    );
    expect(menu).toContain(
      '{ title: "Rekap Invoice", url: "/mektek/finance/invoices" }',
    );
    expect(menu).toContain(
      '{ title: "Audit Sistem", url: "/mektek/finance/audit" }',
    );
  });

  it("adds Payment Faktur beside Accounting and supports nested menu groups", () => {
    expect(menu).toContain(
      '{ title: "Payment Faktur", url: "/mektek/finance/payment-faktur" }',
    );
    expect(navigation).toContain("items?: NavSubItem[]");
    expect(navigation).toContain("renderSubItem");
  });

  it("renders the implemented Payment Faktur workspace", () => {
    expect(paymentPage).toContain("PaymentFakturManager");
    expect(paymentPage).toContain("paymentFakturEntry.findMany");
  });
});
