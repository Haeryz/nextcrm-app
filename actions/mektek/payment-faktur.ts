"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import { canManageMektekFinance } from "@/lib/mektek/permissions";
import { isFinanceDestinationBank } from "@/lib/mektek/finance-bank-accounts";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export type PaymentFakturEntryInput = {
  customerId: string;
  receiptNumber?: string;
  invoiceNumber: string;
  invoiceDate?: string;
  purchaseOrderNumber?: string;
  destinationBank?: string;
  deliveryDate?: string;
  description: string;
  subtotal: number | string;
  taxAmount: number | string;
  transferDate?: string;
  taxInvoiceNumber?: string;
  installment1?: number | string;
  installment2?: number | string;
  installment3?: number | string;
};

const paymentFakturPath = "/[locale]/mektek/finance/payment-faktur";
const text = (value: unknown, max = 250) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const dateOnly = (value: unknown) => {
  const raw = text(value, 10);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const money = (value: unknown) => {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? new Prisma.Decimal(parsed.toFixed(2))
    : null;
};

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

function parseInput(input: PaymentFakturEntryInput) {
  const customerId = text(input.customerId, 36);
  const invoiceNumber = text(input.invoiceNumber, 100);
  const description = text(input.description, 5000);
  const invoiceDate = dateOnly(input.invoiceDate);
  const deliveryDate = dateOnly(input.deliveryDate);
  const transferDate = dateOnly(input.transferDate);
  const subtotal = money(input.subtotal);
  const taxAmount = money(input.taxAmount);
  const installment1 = money(input.installment1 ?? 0);
  const installment2 = money(input.installment2 ?? 0);
  const installment3 = money(input.installment3 ?? 0);
  const destinationBank = text(input.destinationBank, 180);

  if (!customerId) return { error: "Customer wajib dipilih" } as const;
  if (!invoiceNumber) return { error: "Nomor invoice wajib diisi" } as const;
  if (!description) return { error: "Deskripsi wajib diisi" } as const;
  if (invoiceDate === undefined) return { error: "Tanggal invoice tidak valid" } as const;
  if (deliveryDate === undefined) return { error: "Tanggal pengiriman tidak valid" } as const;
  if (transferDate === undefined) return { error: "Tanggal transfer tidak valid" } as const;
  if (!subtotal || !taxAmount || !installment1 || !installment2 || !installment3) {
    return { error: "Nilai uang tidak valid" } as const;
  }
  if (destinationBank && !isFinanceDestinationBank(destinationBank)) {
    return { error: "Rekening tujuan tidak valid" } as const;
  }
  const grandTotal = subtotal.add(taxAmount);
  if (grandTotal.lte(0)) return { error: "Grand total harus lebih dari 0" } as const;
  if (!transferDate && installment1.add(installment2).add(installment3).gt(grandTotal)) {
    return { error: "Jumlah cicilan tidak boleh melebihi grand total" } as const;
  }

  return {
    data: {
      customerId,
      receiptNumber: text(input.receiptNumber, 100) || null,
      invoiceNumber,
      invoiceDate,
      purchaseOrderNumber: text(input.purchaseOrderNumber, 1000) || null,
      destinationBank: destinationBank || null,
      deliveryDate,
      description,
      subtotal,
      taxAmount,
      grandTotal,
      transferDate,
      taxInvoiceNumber: text(input.taxInvoiceNumber, 100) || null,
      installment1,
      installment2,
      installment3,
    },
  } as const;
}

export async function createPaymentFakturEntry(input: PaymentFakturEntryInput) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const parsed = parseInput(input);
  if ("error" in parsed) return parsed;

  try {
    const customer = await prismadb.paymentFakturCustomer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true },
    });
    if (!customer) return { error: "Customer tidak ditemukan" };
    const row = await prismadb.$transaction(async (transaction) => {
      const latest = await transaction.paymentFakturEntry.findFirst({
        where: {
          customerId: parsed.data.customerId,
          sourceRow: { not: null },
        },
        orderBy: { sourceRow: "desc" },
        select: { sourceRow: true },
      });
      const sourceRow = Math.max(15, (latest?.sourceRow ?? 14) + 1);

      return transaction.paymentFakturEntry.create({
        data: {
          ...parsed.data,
          sourceRow,
          createdBy: access.current.id,
          updatedBy: access.current.id,
        },
      });
    });
    revalidatePath(paymentFakturPath, "page");
    return { data: { id: row.id } };
  } catch (error) {
    console.error("[CREATE_PAYMENT_FAKTUR]", error);
    return { error: "Payment Faktur gagal disimpan" };
  }
}

export async function updatePaymentFakturEntry(
  entryId: string,
  input: PaymentFakturEntryInput,
) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(entryId, 36);
  const parsed = parseInput(input);
  if (!id) return { error: "Data Payment Faktur tidak valid" };
  if ("error" in parsed) return parsed;

  try {
    const row = await prismadb.paymentFakturEntry.update({
      where: { id },
      data: { ...parsed.data, updatedBy: access.current.id },
      select: { id: true },
    });
    revalidatePath(paymentFakturPath, "page");
    return { data: row };
  } catch (error) {
    console.error("[UPDATE_PAYMENT_FAKTUR]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Data Payment Faktur tidak ditemukan" };
    }
    return { error: "Payment Faktur gagal diperbarui" };
  }
}

export async function deletePaymentFakturEntry(entryId: string) {
  const access = await ensureFinanceManager();
  if ("error" in access) return access;
  const id = text(entryId, 36);
  if (!id) return { error: "Data Payment Faktur tidak valid" };

  try {
    await prismadb.paymentFakturEntry.delete({ where: { id } });
    revalidatePath(paymentFakturPath, "page");
    return { data: { id } };
  } catch (error) {
    console.error("[DELETE_PAYMENT_FAKTUR]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Data Payment Faktur tidak ditemukan" };
    }
    return { error: "Payment Faktur gagal dihapus" };
  }
}
