import "server-only";

import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// Single-use hashed unsubscribe link tokens, mirroring PasswordResetToken. Long
// 30-day TTL because links sit in already-delivered inboxes; short tokens would
// expire before a recipient opens the email. One row per (user, channel)
// issuance — prior tokens for the same (user, channel) are deleted before a
// new one is issued, so only the latest sent email's link works.

export const UNSUBSCRIBE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type UnsubscribeChannel = "marketing" | "offers" | "all";

export const hashUnsubscribeToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export function isUnsubscribeChannel(value: unknown): value is UnsubscribeChannel {
  return value === "marketing" || value === "offers" || value === "all";
}

const baseUrl = () =>
  (process.env.EMAIL_UNSUBSCRIBE_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "").replace(/\/+$/, "");

export async function issueUnsubscribeToken(
  userId: string,
  channel: UnsubscribeChannel
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashUnsubscribeToken(token);
  const expiresAt = new Date(Date.now() + UNSUBSCRIBE_TOKEN_TTL_MS);

  // Remove any prior live tokens for this (user, channel) so only the most
  // recently sent email's link is valid. Wrapped in a transaction so a crash
  // cannot leave the user with zero valid tokens.
  await prismadb.$transaction([
    prismadb.emailUnsubscribeToken.deleteMany({
      where: { userId, channel },
    }),
    prismadb.emailUnsubscribeToken.create({
      data: { userId, channel, tokenHash, expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export async function consumeUnsubscribeToken(
  token: string
): Promise<{ userId: string; channel: UnsubscribeChannel } | null> {
  const tokenHash = hashUnsubscribeToken(token);
  const record = await prismadb.emailUnsubscribeToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  // Single-use: claim by setting usedAt. CAS via where usedAt = null avoids a
  // race where the same token is clicked twice concurrently.
  const claimed = await prismadb.emailUnsubscribeToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return { userId: record.userId, channel: record.channel as UnsubscribeChannel };
}

// Validates a token without consuming it (used by the GET confirmation page so
// the link stays valid if the user navigates back). Consumption only happens
// on the explicit POST confirm.
export async function peekUnsubscribeToken(
  token: string
): Promise<{ userId: string; channel: UnsubscribeChannel } | null> {
  const tokenHash = hashUnsubscribeToken(token);
  const record = await prismadb.emailUnsubscribeToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return { userId: record.userId, channel: record.channel as UnsubscribeChannel };
}

export function buildUnsubscribeUrl(
  token: string,
  channel: UnsubscribeChannel,
  locale = "id"
): string {
  const base = baseUrl();
  return `${base}/${locale}/unsubscribe?token=${token}&channel=${channel}`;
}
