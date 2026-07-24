import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Finance supplier-payment document inspection", () => {
  it("serves all three matched documents through a Finance-authorized endpoint", () => {
    const route = source(
      "app/api/mektek/finance/payables/sources/[sourceId]/documents/[document]/route.ts",
    );

    expect(route).toContain("canViewMektekFinance");
    expect(route).toContain("financePayableSource.findUnique");
    expect(route).toContain("renderPurchaseOrderPreviewSvg");
    expect(route).toContain('"Content-Type": "image/svg+xml; charset=utf-8"');
    expect(route).toContain("supplierInvoiceImageData");
    expect(route).toContain("deliveryNoteImageData");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });
});
