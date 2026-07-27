import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import type { SupplierDebtWorkbookReport } from "@/lib/mektek/supplier-debt-report";
import { prismadb } from "@/lib/prisma";

const report = snapshot.report as SupplierDebtWorkbookReport;

// Header/rekap sheet pada workbook bukan pemasok nyata — disembunyikan dari daftar.
const isRekapHeader = (name: string) =>
  /^(rekap|hutang|rekapitulasi)\b/i.test(name.trim()) ||
  /\bper\s+20\d{2}/i.test(name);

/**
 * Menggabungkan nama pemasok dari Laporan Hutang Pemasok (snapshot workbook)
 * dengan pemasok terdaftar di FinanceCounterparty. Dipakai oleh form Receiving
 * dan Monitoring PO sebagai saran dropdown User / PT Tujuan.
 */
export async function getSupplierNameSuggestions(): Promise<string[]> {
  const counterparties = await prismadb.financeCounterparty.findMany({
    where: { role: { in: ["SUPPLIER", "BOTH"] }, isActive: true },
    select: { legalName: true },
  });

  const names = new Set<string>();
  for (const counterparty of counterparties) {
    names.add(counterparty.legalName);
  }
  for (const sheet of report.detailSheets) {
    if (!isRekapHeader(sheet.supplierName)) {
      names.add(sheet.supplierName);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b, "id-ID"));
}
