import "server-only";

import crypto from "crypto";
import { prismadb } from "@/lib/prisma";

// Link-based WhatsApp opt-out, modelled on lib/email/unsubscribe.ts.
//
// Why a link and not "reply STOP": this integration is outbound-only by
// construction. The socket is torn down after every send and nothing subscribes to
// `messages.upsert`, so an inbound reply is not merely unhandled — it is
// unobservable. Honouring "STOP" would require a persistent host, which the whole
// serverless design rules out. A signed link in the message body is therefore the
// only opt-out that can actually work here.
//
// The token is 32 random bytes, stored only as its sha256, and single-use via a
// compare-and-swap on `usedAt` so a double-click cannot double-consume.

export const WHATSAPP_OPT_OUT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Route the opt-out link points at — `app/[locale]/wa-optout/page.tsx`. Kept as a
 * constant so the page and the link can never drift apart; a dead opt-out link is
 * worse than no link at all.
 *
 * Short and unnested on purpose: it is typed out inside a WhatsApp message body.
 */
export const WHATSAPP_OPT_OUT_PATH = "wa-optout";

export type WhatsAppOptOutSource = "customer" | "staff";

export const hashWhatsAppOptOutToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const baseUrl = () =>
  String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

/**
 * Issues a fresh single-use token for a customer.
 *
 * Unlike the email variant this does NOT delete the customer's earlier tokens:
 * WhatsApp messages sit in a chat history the recipient scrolls back through, and
 * an opt-out link that silently stopped working is a compliance problem, not a
 * tidiness one. Expired rows age out via `expiresAt`.
 */
export async function issueWhatsAppOptOutToken(
  customerId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashWhatsAppOptOutToken(token);
  const expiresAt = new Date(Date.now() + WHATSAPP_OPT_OUT_TOKEN_TTL_MS);

  await prismadb.whatsAppOptOutToken.create({
    data: { customerId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Validates a token without consuming it — for the GET confirmation page, so the
 * link survives a back-navigation. Consumption happens only on the explicit POST.
 */
export async function peekWhatsAppOptOutToken(
  token: string,
): Promise<{ customerId: string } | null> {
  const tokenHash = hashWhatsAppOptOutToken(token);
  const record = await prismadb.whatsAppOptOutToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return { customerId: record.customerId };
}

/**
 * Claims the token exactly once. The `usedAt: null` guard on `updateMany` is the
 * compare-and-swap: two concurrent clicks race on the same row and only one
 * update matches.
 */
export async function consumeWhatsAppOptOutToken(
  token: string,
): Promise<{ customerId: string } | null> {
  const tokenHash = hashWhatsAppOptOutToken(token);
  const record = await prismadb.whatsAppOptOutToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  const claimed = await prismadb.whatsAppOptOutToken.updateMany({
    where: { tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return { customerId: record.customerId };
}

/** Marks the customer as opted out of promotional WhatsApp. Idempotent. */
export async function applyWhatsAppOptOut(args: {
  customerId: string;
  source: WhatsAppOptOutSource;
}): Promise<void> {
  await prismadb.catalogCustomer.update({
    where: { id: args.customerId },
    data: {
      whatsappOptedOutAt: new Date(),
      whatsappOptedOutSource: args.source,
    },
  });
}

/** Clears an opt-out (customer re-subscribes, or staff corrects a mistake). */
export async function revokeWhatsAppOptOut(customerId: string): Promise<void> {
  await prismadb.catalogCustomer.update({
    where: { id: customerId },
    data: { whatsappOptedOutAt: null, whatsappOptedOutSource: null },
  });
}

/**
 * Public opt-out URL. Built from `NEXT_PUBLIC_APP_URL` rather than a request header
 * because this link is embedded in an outbound message with no request in scope —
 * and because a host header is attacker-controllable.
 */
export function buildWhatsAppOptOutUrl(token: string, locale = "id"): string {
  return `${baseUrl()}/${locale}/${WHATSAPP_OPT_OUT_PATH}?token=${token}`;
}
