import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Service invoice MekTek logo", () => {
  const invoiceSource = source("actions/mektek/invoice-pdf.ts");
  const deliveryNoteSource = source(
    "actions/mektek/logistics-delivery-note-pdf.ts",
  );
  const assetSource = source("lib/mektek/pdf-assets.ts");

  it("uses the same shared logo asset as the delivery note", () => {
    expect(assetSource).toContain(
      "public/images/logo-pt-mektek-tanjung-lestari.jpg",
    );
    expect(invoiceSource).toContain(
      'import { MEKTEK_PDF_LOGO_PATH } from "@/lib/mektek/pdf-assets"',
    );
    expect(deliveryNoteSource).toContain(
      'import { MEKTEK_PDF_LOGO_PATH } from "@/lib/mektek/pdf-assets"',
    );
    expect(invoiceSource).toMatch(
      /React\.createElement\(Image,\s*\{\s*src: MEKTEK_PDF_LOGO_PATH/,
    );
    expect(invoiceSource).not.toContain(
      'React.createElement(Text, { style: S.logoText }, "MEKTEK")',
    );
  });
});
