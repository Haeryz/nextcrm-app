"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import type { StaffCapability } from "@/lib/auth/staff-capabilities";
import { hasMektekCapability } from "@/lib/mektek/permissions";
import {
  parseSupplierDebtEntryInput,
  type SupplierDebtEntryInput,
} from "@/lib/mektek/supplier-debt-entry";
import {
  parseSupplierDebtTransactionInput,
  type SupplierDebtTransactionInput,
} from "@/lib/mektek/supplier-debt-ledger";
import snapshot from "@/lib/mektek/generated/supplier-debt-report-2026.snapshot.json";
import type { SupplierDebtWorkbookReport } from "@/lib/mektek/supplier-debt-report";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const supplierDebtPath = "/[locale]/mektek/finance/supplier-debt-report";
const report = snapshot.report as SupplierDebtWorkbookReport;

const text = (value: unknown, max = 250) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function ensureFinanceManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  if (!hasMektekCapability(session.user, "MEKTEK_FINANCE")) {
    return { error: "Forbidden: akses Finance diperlukan" } as const;
  }
  const current = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      is_admin: true,
      staffCapabilities: true,
      userStatus: true,
    },
  });
  if (
    !current ||
    current.userStatus !== "ACTIVE" ||
    (!current.is_admin &&
      !(current.staffCapabilities as StaffCapability[]).includes(
        "MEKTEK_FINANCE",
      ))
  ) {
    return { error: "Forbidden: akses Finance sudah berubah" } as const;
  }
  return { current } as const;
}

export async function createSupplierDebtEntry(input: SupplierDebtEntryInput) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const parsed = parseSupplierDebtEntryInput(input);
  if ("error" in parsed) return parsed;

  try {
    const row = await prismadb.$transaction(async (transaction) => {
      const latest = await transaction.mektekSupplierDebtEntry.findFirst({
        where: { sheetKey: parsed.data.sheetKey },
        orderBy: { sourceRow: "desc" },
        select: { sourceRow: true },
      });
      const sourceRow = Math.max(1_000_001, (latest?.sourceRow ?? 1_000_000) + 1);
      return transaction.mektekSupplierDebtEntry.create({
        data: {
          ...parsed.data,
          sourceRow,
          number: parsed.data.number ?? String(sourceRow - 1_000_000),
          createdBy: access.current.id,
          updatedBy: access.current.id,
        },
        select: { id: true },
      });
    });
    revalidatePath(supplierDebtPath, "page");
    return { data: row };
  } catch (error) {
    console.error("[CREATE_SUPPLIER_DEBT_ENTRY]", error);
    return { error: "Baris hutang pemasok gagal disimpan" };
  }
}

export async function updateSupplierDebtEntry(
  entryId: string | undefined,
  sourceRow: number,
  input: SupplierDebtEntryInput,
) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(entryId, 36);
  const parsed = parseSupplierDebtEntryInput(input);
  if (!Number.isInteger(sourceRow) || sourceRow <= 0) {
    return { error: "Baris hutang pemasok tidak valid" };
  }
  if ("error" in parsed) return parsed;

  try {
    const row = id
      ? await prismadb.mektekSupplierDebtEntry.update({
          where: { id },
          data: { ...parsed.data, updatedBy: access.current.id },
          select: { id: true },
        })
      : await prismadb.mektekSupplierDebtEntry.upsert({
          where: {
            sheetKey_sourceRow: {
              sheetKey: parsed.data.sheetKey,
              sourceRow,
            },
          },
          update: { ...parsed.data, updatedBy: access.current.id },
          create: {
            ...parsed.data,
            sourceRow,
            createdBy: access.current.id,
            updatedBy: access.current.id,
          },
          select: { id: true },
        });
    revalidatePath(supplierDebtPath, "page");
    return { data: row };
  } catch (error) {
    console.error("[UPDATE_SUPPLIER_DEBT_ENTRY]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Baris hutang pemasok tidak ditemukan" };
    }
    return { error: "Baris hutang pemasok gagal diperbarui" };
  }
}

const snapshotEntry = (sheetKey: string, sourceRow: number) =>
  report.detailSheets
    .find((sheet) => sheet.sheetKey === sheetKey)
    ?.entries.find((entry) => entry.sourceRow === sourceRow);

async function debtState(
  transaction: Prisma.TransactionClient,
  sheetKey: string,
  sourceRow: number,
) {
  const persisted = await transaction.mektekSupplierDebtEntry.findUnique({
    where: { sheetKey_sourceRow: { sheetKey, sourceRow } },
    select: { grandTotal: true, paymentAmount: true },
  });
  const imported = snapshotEntry(sheetKey, sourceRow);
  if (!persisted && !imported) return null;
  const grandTotal = Number(persisted?.grandTotal ?? imported?.grandTotal ?? 0);
  const basePayment = Number(
    persisted?.paymentAmount ?? imported?.paymentAmount ?? 0,
  );
  const ledger = await transaction.mektekSupplierDebtTransaction.aggregate({
    where: { sheetKey, sourceRow, kind: "PAYMENT" },
    _sum: { amount: true },
  });
  const paid = basePayment + Number(ledger._sum.amount ?? 0);
  return {
    grandTotal,
    remainingAmount: Math.max(grandTotal - paid, 0),
  };
}

async function depositBalance(
  transaction: Prisma.TransactionClient,
  sheetKey: string,
) {
  const [deposits, uses] = await Promise.all([
    transaction.mektekSupplierDebtTransaction.aggregate({
      where: { sheetKey, kind: "DEPOSIT" },
      _sum: { amount: true },
    }),
    transaction.mektekSupplierDebtTransaction.aggregate({
      where: { sheetKey, kind: "PAYMENT", paymentSource: "DEPOSIT" },
      _sum: { amount: true },
    }),
  ]);
  return Math.max(
    Number(deposits._sum.amount ?? 0) - Number(uses._sum.amount ?? 0),
    0,
  );
}

export async function recordSupplierDebtTransaction(
  locator: { sheetKey: string; sourceRow: number },
  input: SupplierDebtTransactionInput,
) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const sheetKey = text(locator.sheetKey, 120);
  const sourceRow = Number(locator.sourceRow);
  const parsed = parseSupplierDebtTransactionInput(input);
  if (
    !report.detailSheets.some((sheet) => sheet.sheetKey === sheetKey) ||
    !Number.isInteger(sourceRow) ||
    sourceRow <= 0
  ) {
    return { error: "Baris hutang pemasok tidak valid" };
  }
  if ("error" in parsed) return { error: parsed.error };

  try {
    const result = await prismadb.$transaction(async (transaction) => {
      const transactionIds: string[] = [];
      const state = await debtState(transaction, sheetKey, sourceRow);
      if (!state) throw new Error("ENTRY_NOT_FOUND");
      const appliedAmount =
        parsed.data.kind === "DEPOSIT"
          ? parsed.data.appliedAmount
          : parsed.data.amount;
      if (appliedAmount > state.remainingAmount) {
        throw new Error("PAYMENT_EXCEEDS_REMAINING");
      }

      if (
        parsed.data.kind === "PAYMENT" &&
        parsed.data.paymentSource === "DEPOSIT"
      ) {
        const availableDeposit = await depositBalance(transaction, sheetKey);
        if (parsed.data.amount > availableDeposit) {
          throw new Error("DEPOSIT_INSUFFICIENT");
        }
      }

      if (parsed.data.kind === "DEPOSIT") {
        const depositTx = await transaction.mektekSupplierDebtTransaction.create({
          data: {
            sheetKey,
            sourceRow,
            kind: "DEPOSIT",
            amount: new Prisma.Decimal(parsed.data.amount),
            transactionDate: new Date(
              `${parsed.data.transactionDate}T00:00:00.000Z`,
            ),
            reference: parsed.data.reference,
            note: parsed.data.note,
            createdBy: access.current.id,
          },
        });
        transactionIds.push(depositTx.id);
        if (parsed.data.appliedAmount > 0) {
          const paymentTx = await transaction.mektekSupplierDebtTransaction.create({
            data: {
              sheetKey,
              sourceRow,
              kind: "PAYMENT",
              paymentSource: "DEPOSIT",
              amount: new Prisma.Decimal(parsed.data.appliedAmount),
              transactionDate: new Date(
                `${parsed.data.transactionDate}T00:00:00.000Z`,
              ),
              reference: parsed.data.reference,
              note: parsed.data.note,
              createdBy: access.current.id,
            },
          });
          transactionIds.push(paymentTx.id);
        }
      } else {
        const paymentTx = await transaction.mektekSupplierDebtTransaction.create({
          data: {
            sheetKey,
            sourceRow,
            kind: "PAYMENT",
            paymentSource: parsed.data.paymentSource,
            amount: new Prisma.Decimal(parsed.data.amount),
            transactionDate: new Date(
              `${parsed.data.transactionDate}T00:00:00.000Z`,
            ),
            reference: parsed.data.reference,
            note: parsed.data.note,
            createdBy: access.current.id,
          },
        });
        transactionIds.push(paymentTx.id);
      }

      return {
        remainingDebt: state.remainingAmount - appliedAmount,
        remainingDeposit:
          parsed.data.kind === "DEPOSIT"
            ? parsed.data.remainingDeposit
            : await depositBalance(transaction, sheetKey),
        transactionIds,
      };
    });
    revalidatePath(supplierDebtPath, "page");
    return { data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ENTRY_NOT_FOUND") {
        return { error: "Baris hutang pemasok tidak ditemukan" };
      }
      if (error.message === "PAYMENT_EXCEEDS_REMAINING") {
        return { error: "Nominal pembayaran melebihi sisa hutang" };
      }
      if (error.message === "DEPOSIT_INSUFFICIENT") {
        return { error: "Saldo deposit pemasok tidak mencukupi" };
      }
    }
    console.error("[RECORD_SUPPLIER_DEBT_TRANSACTION]", error);
    return { error: "Transaksi pemasok gagal disimpan" };
  }
}

export async function deleteSupplierDebtTransactions(transactionIds: string[]) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const ids = transactionIds
    .map((value) => text(value, 36))
    .filter(Boolean);
  if (!ids.length) return { error: "ID transaksi tidak valid" };

  try {
    await prismadb.mektekSupplierDebtTransaction.deleteMany({
      where: { id: { in: ids } },
    });
    revalidatePath(supplierDebtPath, "page");
    return { data: { deleted: ids.length } };
  } catch (error) {
    console.error("[DELETE_SUPPLIER_DEBT_TRANSACTIONS]", error);
    return { error: "Gagal menghapus transaksi" };
  }
}

export async function deleteSupplierDebtEntry(entryId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(entryId, 36);
  if (!id) return { error: "Baris hutang pemasok tidak valid" };

  try {
    await prismadb.mektekSupplierDebtEntry.delete({ where: { id } });
    revalidatePath(supplierDebtPath, "page");
    return { data: { id } };
  } catch (error) {
    console.error("[DELETE_SUPPLIER_DEBT_ENTRY]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Baris hutang pemasok tidak ditemukan" };
    }
    return { error: "Baris hutang pemasok gagal dihapus" };
  }
}
