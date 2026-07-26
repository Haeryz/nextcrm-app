import "server-only";

import crypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { phoneDigits } from "@/lib/phone";
import type { WhatsAppSendCategory } from "@/lib/whatsapp/types";

// Audit trail for every outbound WhatsApp message. The owner's number was
// suspended once with no record of what had been sent, so the log exists to answer
// "what went out, to how many distinct recipients, how fast" after the fact.
//
// The plaintext number is never stored: `recipientHash` is sha256 of the canonical
// E.164 value (the same construction as EmailLog.recipientHash in
// lib/email/validation.ts), which still supports "how many messages did this one
// recipient get" lookups, and `recipientMasked` exists purely so a human reading the
// table can recognise a number without the table itself becoming a phone book.

export type WhatsAppLogStatus = "sent" | "failed" | "suppressed";

/** Column widths from prisma/schema.prisma — values are truncated to match. */
const PURPOSE_MAX = 40;
const MASKED_MAX = 24;

export const WHATSAPP_PURPOSE_FALLBACK = "unspecified";

/**
 * sha256 of the canonical phone number. Mirrors `emailRecipientHash`: hash the
 * already-normalized value so the same recipient always yields the same digest.
 */
export function whatsappRecipientHash(phoneNormalized: string): string {
  return crypto
    .createHash("sha256")
    .update(String(phoneNormalized || "").trim())
    .digest("hex");
}

/**
 * Display-only rendering, e.g. `+62812****890`. Enough for an operator to spot a
 * number they recognise, not enough to dial it out of the audit table.
 */
export function maskWhatsAppRecipient(phoneNormalized: string): string {
  const digits = phoneDigits(phoneNormalized);
  if (!digits) return "unknown";
  if (digits.length <= 8) return `+${"*".repeat(digits.length)}`;
  return `+${digits.slice(0, 5)}****${digits.slice(-3)}`.slice(0, MASKED_MAX);
}

/** Keeps purpose slugs short, lowercase and column-safe. */
export function normalizeWhatsAppPurpose(purpose?: string | null): string {
  const slug = String(purpose ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || WHATSAPP_PURPOSE_FALLBACK).slice(0, PURPOSE_MAX);
}

export type RecordWhatsAppSendArgs = {
  phoneNormalized: string;
  purpose: string;
  category: WhatsAppSendCategory;
  status: WhatsAppLogStatus;
  error?: string | null;
  /** Staff member who triggered it; null for cron/system sends. */
  sentById?: string | null;
};

/**
 * Writes exactly one audit row. Never throws: a send must not fail because the
 * audit write did, and a suppression must still return its reason to the caller.
 * A failure here is loud in the server log instead.
 */
export async function recordWhatsAppSend(
  args: RecordWhatsAppSendArgs,
): Promise<void> {
  try {
    await prismadb.whatsAppMessageLog.create({
      data: {
        recipientHash: whatsappRecipientHash(args.phoneNormalized),
        recipientMasked: maskWhatsAppRecipient(args.phoneNormalized),
        purpose: normalizeWhatsAppPurpose(args.purpose),
        category: args.category,
        status: args.status,
        error: args.error ? String(args.error) : null,
        sentById: args.sentById ?? null,
      },
    });
  } catch (error) {
    console.error("[WHATSAPP_SEND_LOG]", error);
  }
}
