"use server";
import crypto from "crypto";
import { headers } from "next/headers";

import { prismadb } from "@/lib/prisma";
import PasswordResetEmail from "@/emails/PasswordReset";
import resendHelper from "@/lib/resend";
import { getClientIp } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import { APP_NAME } from "@/lib/brand";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_SUCCESS =
  "Jika Account dengan Email tersebut tersedia, Link Reset Password telah dikirim.";

// Rate limits: keep both request and confirm cheap to defend but hard to abuse.
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const CONFIRM_LIMIT = 10;
const CONFIRM_WINDOW_MS = 15 * 60 * 1000;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const baseUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

/**
 * Step 1 of the reset flow. Never reveals whether the email exists (no user
 * enumeration), never mutates the current password, and emails a single-use,
 * time-limited *link* rather than a new plaintext password. Rate limited per IP.
 */
export const requestPasswordReset = async (email: string) => {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi." };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: "Email wajib diisi!" };
  }

  const ip = getClientIp(await headers());
  const limit = await consumeAuthRateLimit(
    `password-reset-request:${ip}`,
    REQUEST_LIMIT,
    REQUEST_WINDOW_MS
  );
  if (!limit.ok) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  try {
    const user = await prismadb.users.findFirst({
      where: { email: normalizedEmail },
    });

    // Only send an email when the account exists, but always return the same
    // generic message so the response can't be used to probe for accounts.
    if (user) {
      const resend = await resendHelper();

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      // Invalidate any outstanding tokens for this user, then issue a fresh one.
      await prismadb.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      await prismadb.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const lang = String(user.userLanguage || "id");
      const resetLink = `${baseUrl()}/${lang}/reset-password?token=${token}`;

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: user.email,
        subject: `${APP_NAME} - Atur Ulang Kata Sandi`,
        text: lang === "id"
          ? `Reset Password Anda: ${resetLink}`
          : lang === "en"
            ? `Reset your password: ${resetLink}`
            : `Obnovte si heslo: ${resetLink}`,
        react: PasswordResetEmail({
          username: user?.name!,
          avatar: user.avatar,
          email: user.email,
          resetLink,
          userLanguage: lang,
        }),
      });
    }

    return { success: true, message: GENERIC_SUCCESS };
  } catch (error) {
    console.log("[PASSWORD_RESET_REQUEST]", error);
    // Still return generic success to avoid leaking internal/enumeration signals.
    return { success: true, message: GENERIC_SUCCESS };
  }
};

/**
 * Step 2 of the reset flow. Consumes a valid, unexpired, unused token and sets a
 * new password chosen by the user. The token is single-use.
 */
export const resetPassword = async (token: string, newPassword: string) => {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi." };
  }

  const rawToken = String(token ?? "").trim();
  const password = String(newPassword ?? "");

  if (!rawToken) {
    return { error: "Link Reset Password tidak valid atau kedaluwarsa." };
  }
  if (password.length < 8) {
    return { error: "Password minimal 8 karakter." };
  }
  if (password.length > 100) {
    return { error: "Password terlalu panjang." };
  }

  const ip = getClientIp(await headers());
  const limit = await consumeAuthRateLimit(
    `password-reset-confirm:${ip}`,
    CONFIRM_LIMIT,
    CONFIRM_WINDOW_MS
  );
  if (!limit.ok) {
    return { error: "Terlalu banyak Request. Silakan coba lagi nanti." };
  }

  try {
    const tokenHash = hashToken(rawToken);
    const record = await prismadb.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return { error: "Link Reset Password tidak valid atau kedaluwarsa." };
    }

    const revokedAt = new Date();
    await prismadb.$transaction([
      prismadb.users.update({
        where: { id: record.userId },
        data: {
          password: await hashPassword(password),
          authVersion: { increment: 1 },
        },
      }),
      // Single-use: burn every token for this user once one is redeemed.
      prismadb.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      }),
      // A credential reset is a security boundary: revoke every remembered device.
      prismadb.customerSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt },
      }),
    ]);

    return { success: true, message: "Password berhasil diperbarui. Anda sekarang dapat Login." };
  } catch (error) {
    console.log("[PASSWORD_RESET_CONFIRM]", error);
    return { error: "Gagal melakukan Reset Password" };
  }
};
