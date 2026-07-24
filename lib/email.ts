import "server-only";

import { prismadb } from "@/lib/prisma";
import { areExternalApisDisabled } from "@/lib/external-apis";
import resendHelper from "@/lib/resend";
import { emailRecipientHash } from "@/lib/email/validation";
import {
  issueUnsubscribeToken,
  buildUnsubscribeUrl,
  type UnsubscribeChannel,
} from "@/lib/email/unsubscribe";

// Send orchestration layer. All email sending goes through this module so the
// provider (Resend today) can be swapped to self-hosted SMTP or another
// provider later by editing only this file — relevant because the project
// plans to buy a domain + VPS. lib/resend.ts stays untouched (it keeps serving
// actions/auth/password-reset.ts).

export type EmailPurpose = "otp" | "password-reset" | "marketing" | "offers";

type SendTransactionalArgs = {
  to: string;
  subject: string;
  react: React.ReactNode;
  purpose: EmailPurpose;
  userId?: string;
  // Optional plaintext fallback (Resend uses `react` for HTML, `text` for the
  // text/plain alternative). Keeps emails readable in text-only clients.
  text?: string;
};

type SendResult = { ok: boolean; providerId?: string; error?: string };

const isProd = process.env.NODE_ENV === "production";

// Resend's free onboarding domain — testing only (sends to the account owner).
const TEST_FROM = "onboarding@resend.com";

function resolveFromAddress(purpose: EmailPurpose): string {
  const isBulk = purpose === "marketing" || purpose === "offers";
  const from =
    (isBulk
      ? process.env.EMAIL_MARKETING_FROM
      : process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM) || "";

  if (from) return from;

  // Fail closed in production: sending bulk from an unconfigured From damages
  // deliverability and can get the sender banned. In dev/prototype fall back to
  // Resend's onboarding domain and warn loudly.
  if (isProd) {
    throw new Error(
      `Missing ${
        isBulk ? "EMAIL_MARKETING_FROM" : "RESEND_FROM_EMAIL"
      } — set it to a domain verified in Resend.`
    );
  }
  console.warn(
    `[EMAIL] No From address configured for purpose="${purpose}"; falling back to ${TEST_FROM} (testing only).`
  );
  return TEST_FROM;
}

// Plain-text {{variable}} substitution. No raw HTML is ever authored or
// rendered — admin template bodies are plain text rendered through fixed React
// templates (emails/*.tsx), which avoids XSS in email clients.
export function renderTemplateBody(
  body: string,
  variables: Record<string, string>
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value !== undefined ? String(value) : "";
  });
}

async function writeLog(args: {
  recipientHash: string;
  userId?: string;
  purpose: EmailPurpose;
  status: string;
  providerId?: string;
  error?: string;
}): Promise<void> {
  try {
    await prismadb.emailLog.create({
      data: {
        recipientHash: args.recipientHash,
        userId: args.userId ?? null,
        purpose: args.purpose,
        status: args.status,
        providerId: args.providerId ?? null,
        error: args.error ?? null,
      },
    });
  } catch (error) {
    // Logging must never break the send path; it is observability only.
    console.error("[EMAIL_LOG_WRITE]", error);
  }
}

export async function sendTransactionalEmail(
  args: SendTransactionalArgs
): Promise<SendResult> {
  const recipientHash = emailRecipientHash(args.to);
  const from = resolveFromAddress(args.purpose);

  if (areExternalApisDisabled()) {
    console.log(
      `[EMAIL] (prototype/noop) to=${args.to} purpose=${args.purpose} subject="${args.subject}"`
    );
    return { ok: true };
  }

  try {
    const resend = await resendHelper();
    const response = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      react: args.react,
      ...(args.text ? { text: args.text } : {}),
    });

    // Resend returns { data: { id } | null, error: ... }.
    const data = (response as { data?: { id?: string } | null }).data;
    const error = (response as { error?: { message?: string } | null }).error;
    const providerId = data?.id;

    if (error || !providerId) {
      const message = error?.message || "Unknown Resend error";
      await writeLog({
        recipientHash,
        userId: args.userId,
        purpose: args.purpose,
        status: "failed",
        error: message,
      });
      return { ok: false, error: message };
    }

    await writeLog({
      recipientHash,
      userId: args.userId,
      purpose: args.purpose,
      status: "sent",
      providerId,
    });
    return { ok: true, providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    console.error("[EMAIL_SEND]", error);
    await writeLog({
      recipientHash,
      userId: args.userId,
      purpose: args.purpose,
      status: "failed",
      error: message,
    });
    return { ok: false, error: message };
  }
}

export type BulkRecipient = {
  userId: string;
  email: string;
  username?: string | null;
  userLanguage?: string;
};

export type BulkSendResult = {
  sent: number;
  skipped: number;
  failed: number;
};

// Sends a marketing/offers batch synchronously. Chunked with Promise.allSettled
// in groups of 50 (Resend concurrent send cap). Per-recipient unsubscribe token
// + List-Unsubscribe / List-Unsubscribe-Post headers satisfy Gmail/Yahoo bulk
// sender requirements (RFC 8058 one-click unsubscribe). Opt-in and frequency
// caps are enforced by the caller (actions/mektek/email-campaigns.ts).
export async function sendBulkEmails(args: {
  recipients: BulkRecipient[];
  subject: string;
  react: (ctx: { recipient: BulkRecipient; unsubscribeUrl: string }) => React.ReactNode;
  text?: (recipient: BulkRecipient) => string;
  purpose: Extract<EmailPurpose, "marketing" | "offers">;
  channel: UnsubscribeChannel;
  locale?: string;
}): Promise<BulkSendResult> {
  const CHUNK = 50;
  let sent = 0;
  let failed = 0;

  if (args.recipients.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  for (let i = 0; i < args.recipients.length; i += CHUNK) {
    const chunk = args.recipients.slice(i, i + CHUNK);
    // Pre-issue unsubscribe tokens for the chunk so sends can run in parallel.
    const prepared = await Promise.all(
      chunk.map(async (recipient) => {
        const { token } = await issueUnsubscribeToken(
          recipient.userId,
          args.channel
        );
        return { recipient, token, unsubscribeUrl: buildUnsubscribeUrl(token, args.channel, args.locale) };
      })
    );

    const results = await Promise.allSettled(
      prepared.map(({ recipient, unsubscribeUrl }) =>
        sendTransactionalEmailWithHeaders({
          to: recipient.email,
          userId: recipient.userId,
          subject: args.subject,
          react: args.react({ recipient, unsubscribeUrl }),
          text: args.text?.(recipient),
          purpose: args.purpose,
          unsubscribeUrl,
        })
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) sent += 1;
      else failed += 1;
    }
  }

  return { sent, skipped: 0, failed };
}

// Like sendTransactionalEmail but attaches List-Unsubscribe headers. Resend
// passes through the `headers` field on emails.send.
async function sendTransactionalEmailWithHeaders(args: {
  to: string;
  userId: string;
  subject: string;
  react: React.ReactNode;
  text?: string;
  purpose: EmailPurpose;
  unsubscribeUrl: string;
}): Promise<SendResult> {
  const recipientHash = emailRecipientHash(args.to);
  const from = resolveFromAddress(args.purpose);

  if (areExternalApisDisabled()) {
    console.log(
      `[EMAIL] (prototype/noop) bulk to=${args.to} purpose=${args.purpose}`
    );
    return { ok: true };
  }

  try {
    const resend = await resendHelper();
    const response = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      react: args.react,
      headers: {
        "List-Unsubscribe": `<${args.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      ...(args.text ? { text: args.text } : {}),
    });
    const data = (response as { data?: { id?: string } | null }).data;
    const error = (response as { error?: { message?: string } | null }).error;
    const providerId = data?.id;

    if (error || !providerId) {
      const message = error?.message || "Unknown Resend error";
      await writeLog({
        recipientHash,
        userId: args.userId,
        purpose: args.purpose,
        status: "failed",
        error: message,
      });
      return { ok: false, error: message };
    }

    await writeLog({
      recipientHash,
      userId: args.userId,
      purpose: args.purpose,
      status: "sent",
      providerId,
    });
    return { ok: true, providerId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk send failed";
    console.error("[EMAIL_BULK_SEND]", error);
    await writeLog({
      recipientHash,
      userId: args.userId,
      purpose: args.purpose,
      status: "failed",
      error: message,
    });
    return { ok: false, error: message };
  }
}

// Called by the Resend webhook handler (app/api/resend-webhook/route.ts) on
// bounced/complained events. After 3 bounces for a domain, auto-blocks the
// domain so future sends are skipped.
export async function recordEmailBounce(args: {
  recipientHash: string;
  providerId?: string;
  status: "bounced" | "complained" | "failed";
}): Promise<void> {
  try {
    // Mark the most recent matching log row. updateMany takes a non-unique
    // filter, so a compound recipientHash + providerId filter is valid here.
    await prismadb.emailLog.updateMany({
      where: args.providerId
        ? { recipientHash: args.recipientHash, providerId: args.providerId }
        : { recipientHash: args.recipientHash },
      data: { status: args.status },
    });
  } catch (error) {
    console.error("[EMAIL_BOUNCE_RECORD]", error);
  }
}

// Auto-block a domain after repeated bounces. Called by the webhook when a
// bounce event carries a recipient email.
export async function autoBlockDomainOnBounce(email: string): Promise<void> {
  try {
    const normalized = email.trim().toLowerCase();
    const at = normalized.lastIndexOf("@");
    if (at < 0) return;
    const domain = normalized.slice(at + 1);
    if (!domain) return;

    // Count recent bounces for this domain's recipient hash.
    const recipientHash = emailRecipientHash(normalized);
    const recent = await prismadb.emailLog.count({
      where: { recipientHash, status: "bounced" },
    });
    if (recent >= 3) {
      await prismadb.blockedEmailDomain.upsert({
        where: { domain },
        create: { domain, source: "auto-bounce" },
        update: {},
      });
    }
  } catch (error) {
    console.error("[EMAIL_AUTO_BLOCK]", error);
  }
}
