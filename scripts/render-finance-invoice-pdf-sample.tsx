import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderFinanceInvoicePdf } from "@/actions/mektek/finance-invoice-pdf";

async function main() {
  const outputDirectory = path.join(process.cwd(), "output", "pdf");
  const outputPath = path.join(
    outputDirectory,
    "finance-invoice-print-ready-sample.pdf",
  );

  await mkdir(outputDirectory, { recursive: true });
  const pdf = await renderFinanceInvoicePdf({
  invoiceNumber: "MTL0163626",
  customerName: "PT. Putra Perkasa Abadi",
  invoiceDate: new Date("2026-07-23T00:00:00.000Z"),
  dueDate: new Date("2026-08-23T00:00:00.000Z"),
  deliveryNoteNumber: "SJ-4000689595",
  purchaseOrderNumber: "4000689595",
  purchaseOrderDate: new Date("2026-06-11T00:00:00.000Z"),
  accountDestination: "Mandiri (031-00-1134863-1)",
  currency: "IDR",
  subtotal: 4_795_000,
  taxRate: 11,
  taxAmount: 527_450,
  total: 5_322_450,
  notes: "Dokumen contoh untuk verifikasi tata letak.",
  lines: [
    ["RECEIVER DRYER", "51440-47857L", 1, 225_000],
    ["EXPANTION VALVE", "DI261411-0260", 1, 177_000],
    ["BOLT EXPANSI", "BT-EXP-001", 2, 10_000],
    ["FREON", "059888-6118", 1, 2_400_000],
    ["MOTOR BLOWER", "ND51500-10770L", 1, 1_103_000],
    ["OIL ND8", "MA446963-0260", 1, 330_000],
    ["CAP VALVE HIGH", "SP013", 4, 5_000],
    ["CAP VALVE LOW", "SP014", 4, 5_000],
    ["RELAY", "058700-4140", 4, 125_000],
  ].map(([description, partNumber, quantity, unitPrice]) => ({
    description: String(description),
    partNumber: String(partNumber),
    quantity: Number(quantity),
    unitPrice: Number(unitPrice),
    lineTotal: Number(quantity) * Number(unitPrice),
  })),
  });
  await writeFile(outputPath, Buffer.from(pdf));
  process.stdout.write(outputPath);
}

void main();
