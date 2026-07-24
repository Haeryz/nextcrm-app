import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";
import { recordEmailBounce, autoBlockDomainOnBounce } from "@/lib/email";
import { emailRecipientHash } from "@/lib/email/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resend webhook handler. Resend posts deliverability events (delivered,
// bounced, complained, opened, clicked). We only act on bounce/complaint —
// those feed EmailLog status updates and the auto-blocklist.
//
// Auth: HMAC-SHA256 over the raw body with RESEND_WEBHOOK_SECRET. Constant-time
// compare to avoid timing oracle. Pass-through in proxy.ts (no session) — the
// signature IS the auth.

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed if webhook secret not configured
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type ResendEvent = {
  type?: string; // e.g. "email.bounced", "email.complained", "email.delivered"
  data?: {
    email_id?: string;
    to?: string | string[];
    // Resend embeds bounce details under data.error or data.bounce depending on version
    error?: { message?: string };
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const verified = verifySignature(rawBody, req.headers.get("resend-signature"));
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = String(event?.type ?? "");
  const data = event?.data ?? {};
  const providerId = data.email_id ? String(data.email_id) : undefined;
  const recipient =
    typeof data.to === "string" ? data.to : Array.isArray(data.to) ? data.to[0] : "";

  // Map Resend event -> EmailLog status. Only the actionable subset.
  let status: "bounced" | "complained" | "failed" | null = null;
  if (type === "email.bounced") status = "bounced";
  else if (type === "email.complained") status = "complained";
  else if (type === "email.failed") status = "failed";

  if (status) {
    const recipientHash = recipient ? emailRecipientHash(recipient) : "";
    if (recipientHash) {
      await recordEmailBounce({ recipientHash, providerId, status });
    }
    // After 3 bounces for a domain, auto-block it so future sends skip it.
    if (status === "bounced" && recipient) {
      await autoBlockDomainOnBounce(recipient);
    }
  }

  return NextResponse.json({ received: true });
}
