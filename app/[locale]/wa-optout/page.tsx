import type { Metadata } from "next";

import {
  hashWhatsAppOptOutToken,
  peekWhatsAppOptOutToken,
} from "@/lib/mektek/whatsapp-optout";
import { prismadb } from "@/lib/prisma";

import { WhatsAppOptOutScreen } from "./_components/WhatsAppOptOutScreen";
import type { WhatsAppOptOutState } from "./optout-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berhenti terima promosi WhatsApp — Mektek",
  robots: { index: false, follow: false },
};

interface WhatsAppOptOutPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ token?: string | string[] }>;
}

/**
 * GET only *peeks* at the token. WhatsApp (and some Android browsers) prefetch
 * link previews, so consuming on GET would silently opt people out before they
 * ever pressed anything. The token is spent on the explicit POST instead.
 */
async function resolveTokenState(token: string): Promise<WhatsAppOptOutState> {
  if (!token) return { outcome: "invalid" };

  const peeked = await peekWhatsAppOptOutToken(token);

  if (!peeked) {
    // peek collapses every failure into null; read the row once more purely to
    // tell the customer which of the three things went wrong.
    const record = await prismadb.whatsAppOptOutToken.findUnique({
      where: { tokenHash: hashWhatsAppOptOutToken(token) },
      select: { usedAt: true, expiresAt: true, customerId: true },
    });
    if (!record) return { outcome: "invalid" };
    if (record.usedAt) {
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
    where: { id: peeked.customerId },
    select: { username: true, whatsappOptedOutAt: true },
  });

  return {
    outcome: customer?.whatsappOptedOutAt ? "already" : "confirm",
    customerName: customer?.username ?? null,
  };
}

export default async function WhatsAppOptOutPage({
  params,
  searchParams,
}: WhatsAppOptOutPageProps) {
  const { locale } = await params;
  const query = searchParams ? await searchParams : {};
  const rawToken = Array.isArray(query.token) ? query.token[0] : query.token;
  const token = String(rawToken ?? "").trim();

  let state: WhatsAppOptOutState;
  try {
    state = await resolveTokenState(token);
  } catch (error) {
    console.log("[WHATSAPP_OPT_OUT_PAGE]", error);
    state = { outcome: "error" };
  }

  return (
    <WhatsAppOptOutScreen locale={locale} token={token} initialState={state} />
  );
}
