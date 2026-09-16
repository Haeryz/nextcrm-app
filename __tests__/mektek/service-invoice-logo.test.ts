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
    expect(assetSource).toContain("data:image/jpeg;base64");
    expect(invoiceSource).toContain(
      'import { getMektekPdfLogoSource } from "@/lib/mektek/pdf-assets"',
    );
    expect(deliveryNoteSource).toContain(
      'import { getMektekPdfLogoSource } from "@/lib/mektek/pdf-assets"',
    );
    expect(invoiceSource).toContain("src: logoSource");
    expect(deliveryNoteSource).toContain("src: logoSource");
    expect(invoiceSource).not.toContain(
      'React.createElement(Text, { style: S.logoText }, "MEKTEK")',
    );
  });
});
