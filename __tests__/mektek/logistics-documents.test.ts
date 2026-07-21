import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("MekTek Logistics receipt documents", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const managerSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/_components/LogisticsManager.tsx",
    ),
    "utf8",
  );
  const spreadsheetPageSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/logistics/spreadsheet/page.tsx",
    ),
    "utf8",
  );
  const imageRouteSource = readFileSync(
    resolve(
      process.cwd(),
      "app/api/mektek/logistics/receipts/[id]/image/route.ts",
    ),
    "utf8",
  );
  const pdfRouteSource = readFileSync(
    resolve(
      process.cwd(),
      "app/api/mektek/logistics/receipts/[id]/delivery-note/route.ts",
    ),
    "utf8",
  );
  const pdfSource = readFileSync(
    resolve(process.cwd(), "actions/mektek/logistics-delivery-note-pdf.ts"),
    "utf8",
  );

  it("stores item-condition photos without including the binary in Logistics lists", () => {
    expect(schema).toMatch(/imageData\s+Bytes\?/);
    expect(schema).toMatch(/imageMimeType\s+String\?/);
    expect(imageRouteSource).toContain("validateLogisticsReceiptImageUpload");
    expect(imageRouteSource).toContain("requireMektekLogisticsApiSession");
  });

  it("adds item-condition photo input and protected document actions to receipt history", () => {
    expect(managerSource).toContain('type="file"');
    expect(managerSource).toContain("Foto Kondisi Barang");
    expect(managerSource).not.toContain("Foto Surat Jalan");
    expect(managerSource).toContain("Ambil Foto");
    expect(managerSource).toContain("Pilih dari Galeri");
    expect(managerSource).toContain('capture="environment"');
    expect(managerSource).toContain("Cetak PDF Surat Jalan");
    expect(managerSource).toContain("/api/mektek/logistics/receipts/");
    expect(pdfRouteSource).toContain("requireMektekLogisticsApiSession");
    expect(pdfRouteSource).toContain('"Content-Type": "application/pdf"');
  });

  it("renders a MekTek delivery-note layout based on the supplied example", () => {
    expect(pdfSource).toContain("PT. MEKTEK TANJUNG LESTARI");
    expect(pdfSource).toContain("SURAT JALAN");
    expect(pdfSource).toContain("DESCRIPTION");
    expect(pdfSource).toContain("PART NUMBER");
    expect(pdfSource).toContain("QTY");
  });

  it("makes the return-to-Logistics action visibly bordered", () => {
    expect(spreadsheetPageSource).toMatch(
      /Kembali ke Logistics[\s\S]*variant="outline"|variant="outline"[\s\S]*Kembali ke Logistics/,
    );
  });
});
