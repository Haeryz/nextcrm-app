"use server";

import {
  applyWhatsAppOptOut,
  consumeWhatsAppOptOutToken,
  hashWhatsAppOptOutToken,
} from "@/lib/mektek/whatsapp-optout";
import { prismadb } from "@/lib/prisma";

import type { WhatsAppOptOutState } from "./optout-state";

/**
 * Consumes the opt-out token and records the opt-out.
 *
 * Deliberately unauthenticated: the reader is a logged-out workshop customer
 * opening a link from WhatsApp on their phone. The 32-byte single-use token is
 * the only credential, which is why this route sits outside `(routes)` — that
 * layout would bounce them to /sign-in, which is exactly the bug the email
 * unsubscribe page still has.
 *
 * Token issuing/peeking/consuming all live in lib/mektek/whatsapp-optout.ts;
 * nothing about the token is re-implemented here. The extra read below only
 * classifies *why* a token was rejected, so the customer gets a message that
 * tells them something.
 */
export async function confirmWhatsAppOptOut(
  token: string,
): Promise<WhatsAppOptOutState> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return { outcome: "invalid" };

  try {
    const claimed = await consumeWhatsAppOptOutToken(trimmed);

    if (!claimed) {
      const record = await prismadb.whatsAppOptOutToken.findUnique({
        where: { tokenHash: hashWhatsAppOptOutToken(trimmed) },
        select: { usedAt: true, expiresAt: true, customerId: true },
      });
      if (!record) return { outcome: "invalid" };
      if (record.usedAt) {
        // The link was already spent — usually the customer pressed twice. Their
        // preference is already recorded, so this is reassurance, not an error.
        const customer = await prismadb.catalogCustomer.findUnique({
          where: { id: record.customerId },
          select: { username: true, whatsappOptedOutAt: true },
        });
        return {
          outcome: customer?.whatsappOptedOutAt ? "already" : "used",
          customerName: customer?.username ?? null,
        };
      }
      return { outcome: "expired" };
    }

    const customer = await prismadb.catalogCustomer.findUnique({
      where: { id: claimed.customerId },
      select: { username: true, whatsappOptedOutAt: true },
    });
    const alreadyOptedOut = Boolean(customer?.whatsappOptedOutAt);

    // Idempotent by design: re-stamping an existing opt-out is harmless and
    // keeps the source accurate when a customer confirms it themselves.
    await applyWhatsAppOptOut({
      customerId: claimed.customerId,
      source: "customer",
    });

    return {
      outcome: alreadyOptedOut ? "already" : "success",
      customerName: customer?.username ?? null,
    };
  } catch (error) {
    console.log("[CONFIRM_WHATSAPP_OPT_OUT]", error);
    return { outcome: "error" };
  }
}
