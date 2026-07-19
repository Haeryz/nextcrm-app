"use server";

import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  generatePureRandomVoucherCode,
  pickDictionaryVoucherCode,
  sanitizeVoucherDictionaryEntries,
} from "@/lib/mektek/voucher-code-generator";
import { canManageMektekVouchers } from "@/lib/mektek/permissions";
import { cleanMektekVoucherCode } from "@/lib/mektek/vouchers";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

const MAX_DICTIONARY_NAME_LENGTH = 80;

export type MektekVoucherCodeDictionaryRow = {
  id: string;
  name: string;
  entries: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MektekVoucherCodeRandomizeInput =
  | { mode: "PURE_RANDOM"; length?: number }
  | { mode: "DICTIONARY"; dictionaryId: string };

async function ensureVoucherAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" as const };
  if (!canManageMektekVouchers(session.user)) {
    return { error: "Forbidden: only admins can manage vouchers" as const };
  }
  return { session };
}

function cleanName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_DICTIONARY_NAME_LENGTH);
}

function revalidateVouchers() {
  revalidatePath("/[locale]/(routes)/mektek/vouchers", "page");
}

export async function listMektekVoucherCodeDictionaries() {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const dictionaries = await prismadb.mektekVoucherCodeDictionary.findMany({
    orderBy: [{ name: "asc" }],
  });
  return { data: dictionaries satisfies MektekVoucherCodeDictionaryRow[] };
}

export async function createMektekVoucherCodeDictionary(input: {
  name: string;
  entries: string | string[];
}) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const name = cleanName(input.name);
  const entries = sanitizeVoucherDictionaryEntries(input.entries);
  if (!name) return { error: "Dictionary name is required" };
  if (entries.length === 0) {
    return { error: "Add at least one voucher code with 3 or more characters" };
  }

  try {
    const dictionary = await prismadb.mektekVoucherCodeDictionary.create({
      data: { name, entries },
    });
    revalidateVouchers();
    return { data: dictionary };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "A dictionary with this name already exists" };
    }
    console.log("[CREATE_MEKTEK_VOUCHER_DICTIONARY]", error);
    return { error: "Failed to create code dictionary" };
  }
}

export async function deleteMektekVoucherCodeDictionary(id: string) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  const dictionaryId = String(id ?? "").trim();
  if (!dictionaryId) return { error: "Dictionary ID is required" };

  try {
    await prismadb.mektekVoucherCodeDictionary.delete({ where: { id: dictionaryId } });
    revalidateVouchers();
    return { data: { id: dictionaryId } };
  } catch (error) {
    console.log("[DELETE_MEKTEK_VOUCHER_DICTIONARY]", error);
    return { error: "Code dictionary was not found" };
  }
}

export async function randomizeMektekVoucherCode(input: MektekVoucherCodeRandomizeInput) {
  const access = await ensureVoucherAdmin();
  if ("error" in access) return { error: access.error };

  if (input.mode === "DICTIONARY") {
    const dictionary = await prismadb.mektekVoucherCodeDictionary.findUnique({
      where: { id: String(input.dictionaryId ?? "").trim() },
    });
    if (!dictionary) return { error: "Code dictionary was not found" };

    const normalizedEntries = dictionary.entries.map(cleanMektekVoucherCode);
    const used = await prismadb.mektekVoucher.findMany({
      where: { normalizedCode: { in: normalizedEntries } },
      select: { normalizedCode: true },
    });
    const code = pickDictionaryVoucherCode(
      dictionary.entries,
      new Set(used.map((voucher) => voucher.normalizedCode))
    );
    if (!code) return { error: "Every code in this dictionary is already in use" };
    return { data: { code, mode: input.mode, dictionaryId: dictionary.id } };
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generatePureRandomVoucherCode(input.length);
    const existing = await prismadb.mektekVoucher.findUnique({
      where: { normalizedCode: cleanMektekVoucherCode(code) },
      select: { id: true },
    });
    if (!existing) return { data: { code, mode: input.mode } };
  }
  return { error: "Could not generate a unique voucher code. Try again." };
}
