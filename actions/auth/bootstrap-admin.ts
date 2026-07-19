"use server";
import { headers } from "next/headers";

import { prismadb } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * First-run admin bootstrap.
 *
 * Designed for a non-technical client: they open `/setup` in a browser and fill a
 * short form to create the owner (admin) account — no env editing, no database
 * access, no CLI. The whole flow self-disables the moment an admin exists, so the
 * page/action cannot be used to mint additional admins later.
 */

const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

/** True once at least one admin account exists. Used by the setup page/action. */
export const adminAccountExists = async (): Promise<boolean> => {
  const count = await prismadb.users.count({ where: { is_admin: true } });
  return count > 0;
};

export const bootstrapFirstAdmin = async (data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}) => {
  const name = String(data?.name ?? "").trim().slice(0, 120);
  const email = String(data?.email ?? "").trim().toLowerCase();
  const password = String(data?.password ?? "");
  const confirmPassword = String(data?.confirmPassword ?? "");

  const ip = getClientIp(await headers());
  const limit = checkRateLimit(
    `bootstrap-admin:${ip}`,
    REQUEST_LIMIT,
    REQUEST_WINDOW_MS
  );
  if (!limit.ok) {
    return { error: "Terlalu banyak percobaan. Silakan coba lagi nanti." };
  }

  if (!name || !email || !password || !confirmPassword) {
    return { error: "Semua field wajib diisi." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Masukkan alamat Email yang valid." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }
  if (password.length > 100) {
    return { error: "Password terlalu panjang." };
  }
  if (password !== confirmPassword) {
    return { error: "Password tidak sama." };
  }

  try {
    // Hard gate: refuse if an admin already exists (defends against replay/race).
    if (await adminAccountExists()) {
      return { error: "Setup sudah selesai. Silakan Login." };
    }

    const existing = await prismadb.users.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { error: "Account dengan Email tersebut sudah ada." };
    }

    await prismadb.users.create({
      data: {
        name,
        username: name,
        avatar: "",
        account_name: "",
        is_account_admin: true,
        is_admin: true,
        email,
        userLanguage: "id",
        userStatus: "ACTIVE",
        password: await hashPassword(password),
      },
    });

    return { success: true, message: "Owner Account berhasil dibuat. Anda sekarang dapat Login." };
  } catch (error) {
    console.error("[BOOTSTRAP_ADMIN]", error);
    return { error: "Setup tidak dapat diselesaikan. Silakan coba lagi." };
  }
};
