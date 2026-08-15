"use server";

import { MarketingOffer } from "@/emails/MarketingOffer";
import type { BulkRecipient } from "@/lib/email";
import { sendBulkEmails, renderTemplateBody } from "@/lib/email";
import { authOptions } from "@/lib/auth";
import {
  countAudience,
  describeMektekEmailAudience,
  explainEmptyAudience,
  filterByFrequencyCap,
  resolveEmailAudience,
  validateMektekEmailAudience,
  type AudienceSummary,
  type EmailCampaignChannel,
  type FrequencyCaps,
  type MektekEmailAudienceInput,
} from "@/lib/mektek/email-audience";
import {
  EMAIL_TEMPLATE_PURPOSE_LABELS,
  isEmailTemplatePurpose,
  type EmailTemplatePurpose,
} from "@/lib/mektek/email-templates";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

// Marketing/offers senders.
//
// Two entry points, with very different trust levels:
//   - sendMektekMarketingBatch / sendMektekOffersBatch: the untargeted cron
//     batch. NO auth guard of its own — it is safe only because
//     app/api/cron/* gates it behind CRON_SECRET. Never expose it to the UI.
//   - sendMektekEmailCampaign: the admin-triggered, targeted send. Guarded by
//     ensureEmailCampaignAdmin and takes an explicit audience descriptor.
//
// Security/anti-abuse (all of it lives in this file + lib/mektek/email-audience.ts,
// because lib/email.ts sendBulkEmails checks NEITHER opt-out NOR BlockedEmailDomain):
//   - Opt-in enforced via UserEmailPreference (marketingOptedInAt/OffersOptedInAt
//     set AND corresponding optedOutAt null).
//   - Phone-only accounts (synthesized @phone.nextcrm.local emails) are always
//     excluded — those emails exist only to satisfy the Users.email unique
//     constraint and never receive marketing.
//   - Blocked domains (BlockedEmailDomain) are excluded.
//   - Per-user frequency caps from UserEmailPreference.frequencyCaps vs recent
//     EmailLog count for (userId, purpose).
//   - Per-recipient unsubscribe token + List-Unsubscribe headers (RFC 8058).

const PHONE_ONLY_SUFFIX = "@phone.nextcrm.local";
const DEFAULT_CTA_LABEL = "Selengkapnya";
const MAX_ADHOC_SUBJECT_LENGTH = 200;
const MAX_ADHOC_BODY_LENGTH = 5_000;
const MAX_CTA_LABEL_LENGTH = 40;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "#";
}

async function loadActiveTemplate(purpose: EmailTemplatePurpose) {
  return prismadb.mektekEmailTemplate.findFirst({
    where: { purpose, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

type CampaignResult = { sent: number; skipped: number; failed: number; error?: string };

async function runCampaign(
  purpose: EmailTemplatePurpose,
  channel: EmailCampaignChannel
): Promise<CampaignResult> {
  const template = await loadActiveTemplate(purpose);
  if (!template) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      error: `Tidak ada template aktif untuk ${EMAIL_TEMPLATE_PURPOSE_LABELS[purpose]}`,
    };
  }

  // Load opted-in users with their preference. Opt-in column depends on channel.
  const optInField =
    channel === "marketing" ? "marketingOptedInAt" : "offersOptedInAt";
  const optOutField =
    channel === "marketing" ? "marketingOptedOutAt" : "offersOptedOutAt";

  const preferences = await prismadb.userEmailPreference.findMany({
    where: {
      [optInField]: { not: null },
      [optOutField]: null,
    },
    select: {
      userId: true,
      frequencyCaps: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          userLanguage: true,
        },
      },
    },
  });

  const eligible: BulkRecipient[] = [];
  let skipped = 0;

  // First pass: drop phone-only/missing emails and collect the cap candidates.
  const capCandidates: { userId: string; caps: FrequencyCaps }[] = [];
  const validUsers: Array<{
    userId: string;
    email: string;
    username: string | null;
    userLanguage: string;
  }> = [];

  for (const pref of preferences) {
    const user = pref.user;
    // Phone-only accounts never receive marketing.
    if (!user?.email || user.email.endsWith(PHONE_ONLY_SUFFIX)) {
      skipped += 1;
      continue;
    }
    capCandidates.push({
      userId: user.id,
      caps: pref.frequencyCaps as FrequencyCaps,
    });
    validUsers.push({
      userId: user.id,
      email: user.email,
      username: user.name ?? null,
      userLanguage: user.userLanguage ?? "id",
    });
  }

  // Batched cap check: one groupBy per cap-window bucket instead of one COUNT
  // per user (frequencyCaps is null for nearly every user, so this is almost
  // always exactly one query regardless of audience size).
  const allowedIds = await filterByFrequencyCap(capCandidates, purpose);

  for (const candidate of validUsers) {
    if (!allowedIds.has(candidate.userId)) {
      skipped += 1;
      continue;
    }
    eligible.push({
      userId: candidate.userId,
      email: candidate.email,
      username: candidate.username,
      userLanguage: candidate.userLanguage,
    });
  }

  if (eligible.length === 0) {
    return { sent: 0, skipped, failed: 0 };
  }

  const ctaLabel = DEFAULT_CTA_LABEL;
  const ctaUrl = appUrl();

  const sendResult = await sendBulkEmails({
    recipients: eligible,
    subject: template.subject,
    purpose: channel,
    channel,
    locale: "id",
    react: ({ recipient, unsubscribeUrl }) =>
      MarketingOffer({
        username: recipient.username ?? undefined,
        preheader: template.subject,
        title: template.name,
        // {{ctaLabel}}/{{ctaUrl}} are advertised in the template editor, so they
        // must be substitutable in the body too — previously they rendered as
        // empty strings because only {{username}} was passed.
        bodyText: renderTemplateBody(template.body, {
          username: recipient.username ?? "",
          ctaLabel,
          ctaUrl,
        }),
        ctaLabel,
        ctaUrl,
        unsubscribeUrl,
        userLanguage: recipient.userLanguage ?? "id",
      }),
    text: (recipient) =>
      renderTemplateBody(template.body, {
        username: recipient.username ?? "",
        ctaLabel,
        ctaUrl,
      }),
  });

  return {
    sent: sendResult.sent,
    skipped: skipped + sendResult.skipped,
    failed: sendResult.failed,
  };
}

export async function sendMektekMarketingBatch(): Promise<CampaignResult> {
  try {
    return await runCampaign("marketing", "marketing");
  } catch (error) {
    console.error("[MEKTEK_MARKETING_BATCH]", error);
    return { sent: 0, skipped: 0, failed: 0, error: "Batch marketing gagal" };
  }
}

export async function sendMektekOffersBatch(): Promise<CampaignResult> {
  try {
    return await runCampaign("offers", "offers");
  } catch (error) {
    console.error("[MEKTEK_OFFERS_BATCH]", error);
    return { sent: 0, skipped: 0, failed: 0, error: "Batch penawaran gagal" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Admin-triggered, targeted campaign                                        */
/* -------------------------------------------------------------------------- */

// Same gate as ensureEmailTemplateAdmin (actions/mektek/email-templates.ts).
// Sending is irreversible and goes to real customers, so it stays admin-only.
type CampaignAdminAccess =
  | { error: string }
  | { userId: string; email: string; name: string | null };

async function ensureEmailCampaignAdmin(): Promise<CampaignAdminAccess> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (session.user.userStatus !== "ACTIVE" || !session.user.isAdmin) {
    return {
      error: "Forbidden: only active admins can send email campaigns",
    };
  }
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
  };
}

export type MektekEmailCampaignInput = {
  audience?: MektekEmailAudienceInput;
  channel?: unknown;
  /** Use a saved template… */
  templateId?: unknown;
  /** …or compose ad hoc. Ignored when templateId is set. */
  subject?: unknown;
  body?: unknown;
  title?: unknown;
  ctaLabel?: unknown;
  ctaUrl?: unknown;
  /**
   * The recipient count the admin actually saw and confirmed. When present and
   * no longer accurate, the send is refused rather than silently going to a
   * different number of people.
   */
  expectedRecipientCount?: unknown;
};

type CampaignContent = {
  channel: EmailCampaignChannel;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  source: "template" | "adhoc";
  templateName: string | null;
};

function compact(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function resolveChannel(value: unknown): EmailCampaignChannel {
  return isEmailTemplatePurpose(value) ? value : "marketing";
}

async function resolveCampaignContent(
  input: MektekEmailCampaignInput
): Promise<{ data: CampaignContent } | { error: string }> {
  const ctaUrlRaw = String(input.ctaUrl ?? "").trim();
  const ctaUrl = /^https?:\/\//i.test(ctaUrlRaw) ? ctaUrlRaw : appUrl();
  const ctaLabel = compact(input.ctaLabel, MAX_CTA_LABEL_LENGTH) || DEFAULT_CTA_LABEL;

  const templateId = String(input.templateId ?? "").trim();
  if (templateId) {
    const template = await prismadb.mektekEmailTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return { error: "Template email tidak ditemukan" };
    if (!isEmailTemplatePurpose(template.purpose)) {
      return { error: "Jenis template tidak valid" };
    }
    return {
      data: {
        channel: template.purpose,
        subject: template.subject,
        title: template.name,
        body: template.body,
        ctaLabel,
        ctaUrl,
        source: "template",
        templateName: template.name,
      },
    };
  }

  const subject = compact(input.subject, MAX_ADHOC_SUBJECT_LENGTH);
  const body = String(input.body ?? "").trim().slice(0, MAX_ADHOC_BODY_LENGTH);
  if (!subject) return { error: "Subjek email wajib diisi" };
  if (!body) return { error: "Isi email wajib diisi" };

  return {
    data: {
      channel: resolveChannel(input.channel),
      subject,
      title: compact(input.title, MAX_ADHOC_SUBJECT_LENGTH) || subject,
      body,
      ctaLabel,
      ctaUrl,
      source: "adhoc",
      templateName: null,
    },
  };
}

function renderFor(content: CampaignContent, username: string | null) {
  return renderTemplateBody(content.body, {
    username: username ?? "",
    ctaLabel: content.ctaLabel,
    ctaUrl: content.ctaUrl,
  });
}

function buildEmail(
  content: CampaignContent,
  recipient: BulkRecipient,
  unsubscribeUrl: string
) {
  return MarketingOffer({
    username: recipient.username ?? undefined,
    preheader: content.subject,
    title: content.title,
    bodyText: renderFor(content, recipient.username ?? null),
    ctaLabel: content.ctaLabel,
    ctaUrl: content.ctaUrl,
    unsubscribeUrl,
    userLanguage: recipient.userLanguage ?? "id",
  });
}

export type MektekEmailAudiencePreview = AudienceSummary & {
  audienceLabel: string;
  channel: EmailCampaignChannel;
  emptyReason: string | null;
};

/**
 * Live recipient count for the composer. Runs the exact same resolution the
 * real send uses, so the number the admin confirms is the number attempted.
 */
export async function countMektekEmailCampaignAudience(input: {
  audience?: MektekEmailAudienceInput;
  channel?: unknown;
  customerLabel?: string | null;
}): Promise<{ data: MektekEmailAudiencePreview } | { error: string }> {
  const access = await ensureEmailCampaignAdmin();
  if ("error" in access) return { error: access.error };

  const audience = validateMektekEmailAudience(input?.audience);
  if ("error" in audience) return { error: audience.error };

  const channel = resolveChannel(input?.channel);
  try {
    const summary = await countAudience({ audience: audience.data, channel });
    return {
      data: {
        ...summary,
        channel,
        audienceLabel: describeMektekEmailAudience(
          audience.data,
          input?.customerLabel ?? null
        ),
        emptyReason:
          summary.sendableNow === 0 ? explainEmptyAudience(summary) : null,
      },
    };
  } catch (error) {
    console.error("[MEKTEK_EMAIL_AUDIENCE_COUNT]", error);
    return { error: "Gagal menghitung jumlah penerima" };
  }
}

export type MektekEmailCampaignPreview = {
  channel: EmailCampaignChannel;
  subject: string;
  title: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  source: "template" | "adhoc";
};

/** Plain-text render of what the recipient will read, variables substituted. */
export async function previewMektekEmailCampaign(
  input: MektekEmailCampaignInput & { sampleUsername?: unknown }
): Promise<{ data: MektekEmailCampaignPreview } | { error: string }> {
  const access = await ensureEmailCampaignAdmin();
  if ("error" in access) return { error: access.error };

  const content = await resolveCampaignContent(input);
  if ("error" in content) return { error: content.error };

  const sampleUsername =
    compact(input.sampleUsername, 80) || access.name || "Customer";

  return {
    data: {
      channel: content.data.channel,
      subject: content.data.subject,
      title: content.data.title,
      bodyText: renderFor(content.data, sampleUsername),
      ctaLabel: content.data.ctaLabel,
      ctaUrl: content.data.ctaUrl,
      source: content.data.source,
    },
  };
}

export type MektekEmailCampaignSendResult = {
  sent: number;
  skipped: number;
  failed: number;
  matched: number;
  eligible: number;
  remaining: number;
  audienceLabel: string;
  channel: EmailCampaignChannel;
  note: string | null;
};

/**
 * Sends the campaign to the resolved audience. Admin-guarded, irreversible.
 * Capped at MAX_RECIPIENTS_PER_SEND per invocation (Vercel maxDuration = 60);
 * `remaining` reports the leftovers instead of pretending the run finished.
 */
export async function sendMektekEmailCampaign(
  input: MektekEmailCampaignInput & { customerLabel?: string | null }
): Promise<{ data: MektekEmailCampaignSendResult } | { error: string }> {
  const access = await ensureEmailCampaignAdmin();
  if ("error" in access) return { error: access.error };

  const audience = validateMektekEmailAudience(input?.audience);
  if ("error" in audience) return { error: audience.error };

  const content = await resolveCampaignContent(input);
  if ("error" in content) return { error: content.error };

  const channel = content.data.channel;
  const audienceLabel = describeMektekEmailAudience(
    audience.data,
    input?.customerLabel ?? null
  );

  try {
    const resolved = await resolveEmailAudience({
      audience: audience.data,
      channel,
    });

    // A zero-recipient send is blocked with an explanation, never a silent no-op.
    if (resolved.recipients.length === 0) {
      return { error: explainEmptyAudience(resolved) };
    }

    // Confirmation echo: refuse if the audience moved since the admin confirmed.
    const expected = Number(input.expectedRecipientCount);
    if (Number.isFinite(expected) && expected !== resolved.recipients.length) {
      return {
        error:
          `Jumlah penerima berubah dari ${expected} menjadi ${resolved.recipients.length} ` +
          "sejak Anda menekan konfirmasi. Periksa ulang lalu kirim lagi.",
      };
    }

    const sendResult = await sendBulkEmails({
      recipients: resolved.recipients,
      subject: content.data.subject,
      purpose: channel,
      channel,
      locale: "id",
      react: ({ recipient, unsubscribeUrl }) =>
        buildEmail(content.data, recipient, unsubscribeUrl),
      text: (recipient) => renderFor(content.data, recipient.username ?? null),
    });

    const note =
      resolved.remaining > 0
        ? `Batas ${resolved.recipients.length} penerima per pengiriman tercapai. ` +
          `Masih ada ${resolved.remaining} penerima yang belum dikirimi — jalankan pengiriman lagi untuk sisanya.`
        : null;

    return {
      data: {
        sent: sendResult.sent,
        skipped: resolved.skipped + sendResult.skipped,
        failed: sendResult.failed,
        matched: resolved.matched,
        eligible: resolved.eligible,
        remaining: resolved.remaining,
        audienceLabel,
        channel,
        note,
      },
    };
  } catch (error) {
    console.error("[MEKTEK_EMAIL_CAMPAIGN_SEND]", error);
    return { error: "Pengiriman kampanye email gagal" };
  }
}

/** Sends one copy of the campaign to the signed-in admin, for eyeballing. */
export async function sendMektekEmailCampaignTest(
  input: MektekEmailCampaignInput
): Promise<{ data: { email: string } } | { error: string }> {
  const access = await ensureEmailCampaignAdmin();
  if ("error" in access) return { error: access.error };

  const email = String(access.email ?? "").trim();
  if (!email || !email.includes("@") || email.endsWith(PHONE_ONLY_SUFFIX)) {
    return {
      error:
        "Akun admin Anda tidak punya alamat email asli, jadi email uji tidak bisa dikirim.",
    };
  }

  const content = await resolveCampaignContent(input);
  if ("error" in content) return { error: content.error };

  try {
    const result = await sendBulkEmails({
      recipients: [
        {
          userId: access.userId,
          email,
          username: access.name,
          userLanguage: "id",
        },
      ],
      subject: `[UJI] ${content.data.subject}`.slice(0, MAX_ADHOC_SUBJECT_LENGTH),
      purpose: content.data.channel,
      channel: content.data.channel,
      locale: "id",
      react: ({ recipient, unsubscribeUrl }) =>
        buildEmail(content.data, recipient, unsubscribeUrl),
      text: (recipient) => renderFor(content.data, recipient.username ?? null),
    });
    if (result.sent === 0) {
      return { error: "Email uji gagal dikirim. Periksa konfigurasi Resend." };
    }
    return { data: { email } };
  } catch (error) {
    console.error("[MEKTEK_EMAIL_CAMPAIGN_TEST]", error);
    return { error: "Email uji gagal dikirim" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Send history                                                              */
/* -------------------------------------------------------------------------- */

export type MektekEmailHistoryRow = {
  purpose: string;
  day: string;
  sent: number;
  failed: number;
  total: number;
  recipients: number;
  lastSentAt: string;
};

/**
 * Send history from EmailLog, grouped by (purpose, day) with COUNT/FILTER
 * aggregates done in Postgres — no row-by-row counting in JS.
 *
 * KNOWN LIMITATION: EmailLog has no campaignId/templateId column and the schema
 * is frozen, so a run cannot be attributed to a specific campaign or template.
 * `purpose` is only ever "marketing" or "offers" (lib/email.ts keys both the
 * From address and the frequency cap off it, so it cannot carry a campaign id).
 * Per-day grouping is the finest attribution available.
 */
export async function listMektekEmailCampaignHistory(): Promise<
  { data: MektekEmailHistoryRow[] } | { error: string }
> {
  const access = await ensureEmailCampaignAdmin();
  if ("error" in access) return { error: access.error };

  try {
    const rows = await prismadb.$queryRaw<
      Array<{
        purpose: string;
        day: Date;
        sent: number;
        failed: number;
        total: number;
        recipients: number;
        lastSentAt: Date;
      }>
    >`
      SELECT
        "purpose",
        date_trunc('day', "sentAt") AS "day",
        COUNT(*) FILTER (WHERE "status" = 'sent')::int AS "sent",
        COUNT(*) FILTER (WHERE "status" <> 'sent')::int AS "failed",
        COUNT(*)::int AS "total",
        COUNT(DISTINCT "recipientHash")::int AS "recipients",
        MAX("sentAt") AS "lastSentAt"
      FROM "EmailLog"
      WHERE "purpose" IN ('marketing', 'offers')
      GROUP BY "purpose", date_trunc('day', "sentAt")
      ORDER BY "day" DESC, "purpose" ASC
      LIMIT 60
    `;

    return {
      data: (rows ?? []).map((row) => ({
        purpose: row.purpose,
        day: new Date(row.day).toISOString(),
        sent: Number(row.sent ?? 0),
        failed: Number(row.failed ?? 0),
        total: Number(row.total ?? 0),
        recipients: Number(row.recipients ?? 0),
        lastSentAt: new Date(row.lastSentAt ?? row.day).toISOString(),
      })),
    };
  } catch (error) {
    console.error("[MEKTEK_EMAIL_HISTORY]", error);
    return { data: [] };
  }
}
