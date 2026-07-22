import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("per-customer PDF summary", () => {
  it("provides an authorized PDF route with vehicles and service history", () => {
    const route = read("app/api/mektek/customers/[id]/summary/route.ts");
    expect(route).toContain("requireMektekCustomerToolApiSession");
    expect(route).toContain("renderMektekCustomerSummaryPdf");
    expect(route).toContain("serviceLinks");
    expect(route).toContain('"Content-Type": "application/pdf"');
  });

  it("offers the PDF from each customer detail page", () => {
    const page = read("app/[locale]/(routes)/mektek/customers/[id]/page.tsx");
    expect(page).toContain("PDF Pelanggan");
    expect(page).toContain("/api/mektek/customers/${customer.id}/summary");
  });
});
