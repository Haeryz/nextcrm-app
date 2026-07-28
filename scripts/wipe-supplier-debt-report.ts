import "dotenv/config";

import * as fs from "node:fs";
import * as path from "node:path";

import { prismadb } from "../lib/prisma";

const SNAPSHOT_PATH = path.resolve(
  "lib/mektek/generated/supplier-debt-report-2026.snapshot.json",
);

type SnapshotFile = {
  sourceFile: string;
  report: {
    overview: {
      title: string;
      period: string | null;
      updatedAt: string | null;
      rows: Array<Record<string, unknown>>;
    };
    recap: {
      title: string;
      entries: unknown[];
      monthlySummary: Array<Record<string, unknown>>;
    };
    detailSheets: Array<Record<string, unknown> & {
      entries: unknown[];
    }>;
  };
};

function wipeSnapshot(report: SnapshotFile["report"]) {
  const overviewRows = report.overview.rows.length;
  const recapEntries = report.recap.entries.length;
  const monthlySummaries = report.recap.monthlySummary.length;
  const detailSheets = report.detailSheets.length;
  const detailEntries = report.detailSheets.reduce(
    (total, sheet) => total + sheet.entries.length,
    0,
  );

  report.overview.rows = report.overview.rows.map((row) => ({
    ...row,
    remainingDebt: 0,
    remainingReceivable: 0,
    dueAmount: 0,
    dueDate: null,
    dueDescription: null,
    breakdown: [],
    breakdownNote: null,
  }));
  report.recap.entries = [];
  report.recap.monthlySummary = report.recap.monthlySummary.map((row) => ({
    ...row,
    debtValue: 0,
    paidValue: 0,
    remainingDebt: 0,
  }));
  report.detailSheets = report.detailSheets.map((sheet) => ({
    ...sheet,
    entries: [],
  }));

  return {
    cleared: {
      overviewRows,
      recapEntries,
      monthlySummaries,
      detailEntries,
    },
    preserved: {
      detailSheets,
      supplierNames: report.detailSheets.map((sheet) => sheet.supplierName),
    },
  };
}

async function main() {
  const commit = process.argv.includes("--commit");

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(`Snapshot tidak ditemukan: ${SNAPSHOT_PATH}`);
  }

  const snapshot = JSON.parse(
    fs.readFileSync(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotFile;

  const [entries, transactions] = await Promise.all([
    prismadb.mektekSupplierDebtEntry.count(),
    prismadb.mektekSupplierDebtTransaction.count(),
  ]);

  if (!commit) {
    const detailEntries = snapshot.report.detailSheets.reduce(
      (total, sheet) => total + sheet.entries.length,
      0,
    );
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          action: "wipe-supplier-debt-report",
          willDelete: {
            mektekSupplierDebtEntry: entries,
            mektekSupplierDebtTransaction: transactions,
            snapshotOverviewRows: snapshot.report.overview.rows.length,
            snapshotRecapEntries: snapshot.report.recap.entries.length,
            snapshotDetailEntries: detailEntries,
            snapshotMonthlySummariesZeroed:
              snapshot.report.recap.monthlySummary.length,
          },
          preserved: {
            financeCounterparty: "tidak dihapus (pemasok tetap terdaftar)",
            snapshotDetailSheets: snapshot.report.detailSheets.length,
            snapshotSupplierNames: snapshot.report.detailSheets.map(
              (sheet) => sheet.supplierName,
            ),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const dbResult = await prismadb.$transaction(async (tx) => {
    const deletedTransactions = await tx.mektekSupplierDebtTransaction.deleteMany({});
    const deletedEntries = await tx.mektekSupplierDebtEntry.deleteMany({});
    return {
      mektekSupplierDebtEntry: deletedEntries.count,
      mektekSupplierDebtTransaction: deletedTransactions.count,
    };
  });

  const snapshotResult = wipeSnapshot(snapshot.report);
  fs.writeFileSync(
    SNAPSHOT_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );

  const remainingSuppliers = await prismadb.financeCounterparty.count({
    where: { role: { in: ["SUPPLIER", "BOTH"] } },
  });

  console.log(
    JSON.stringify(
      {
        mode: "commit",
        action: "wipe-supplier-debt-report",
        deleted: dbResult,
        snapshotCleared: snapshotResult.cleared,
        preserved: {
          financeCounterpartySuppliers: remainingSuppliers,
          snapshotDetailSheets: snapshotResult.preserved.detailSheets,
          snapshotSupplierNames: snapshotResult.preserved.supplierNames,
        },
      },
      null,
      2,
    ),
  );
}

main().finally(() => prismadb.$disconnect());
