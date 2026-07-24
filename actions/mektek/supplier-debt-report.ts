"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { canManageMektekFinance } from "@/lib/mektek/permissions";
import {
  parseSupplierDebtEntryInput,
  type SupplierDebtEntryInput,
} from "@/lib/mektek/supplier-debt-entry";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const supplierDebtPath = "/[locale]/mektek/finance/supplier-debt-report";

const text = (value: unknown, max = 250) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function ensureFinanceManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized: silakan Login" } as const;
  if (!canManageMektekFinance(session.user)) {
    return { error: "Forbidden: akses Finance diperlukan" } as const;
  }
  const current = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: { id: true, is_admin: true, staffDivision: true, userStatus: true },
  });
  if (
    !current ||
    current.userStatus !== "ACTIVE" ||
    (!current.is_admin && current.staffDivision !== "FINANCE")
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
  entryId: string,
  input: SupplierDebtEntryInput,
) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(entryId, 36);
  const parsed = parseSupplierDebtEntryInput(input);
  if (!id) return { error: "Baris hutang pemasok tidak valid" };
  if ("error" in parsed) return parsed;

  try {
    const row = await prismadb.mektekSupplierDebtEntry.update({
      where: { id },
      data: { ...parsed.data, updatedBy: access.current.id },
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
