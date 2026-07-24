import * as fs from "node:fs";
import * as path from "node:path";

import * as XLSX from "xlsx";

import { extractSupplierDebtWorkbook } from "../lib/mektek/supplier-debt-report";

const workbookName =
  "DATA LAPORAN TAGIHAN ANG & HUTANG USAHA ALL SUPPLIER 2026_01072026.xlsx";
const inputPath = path.resolve(process.argv[2] ?? path.join("data", workbookName));
const outputPath = path.resolve(
  process.argv[3] ??
    path.join(
      "lib",
      "mektek",
      "generated",
      "supplier-debt-report-2026.snapshot.json",
    ),
);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Workbook tidak ditemukan: ${inputPath}`);
}

const workbook = XLSX.readFile(inputPath, {
  cellDates: true,
  cellFormula: true,
});
const report = extractSupplierDebtWorkbook(workbook);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      sourceFile: path.basename(inputPath),
      report,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify({
    outputPath,
    overviewRows: report.overview.rows.length,
    recapEntries: report.recap.entries.length,
    detailSheets: report.detailSheets.length,
    detailEntries: report.detailSheets.reduce(
      (total, sheet) => total + sheet.entries.length,
      0,
    ),
  }),
);
