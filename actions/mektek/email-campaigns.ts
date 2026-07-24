"use server";

import { prismadb } from "@/lib/prisma";
import { sendTransactionalEmail, sendBulkEmails, renderTemplateBody } from "@/lib/email";
import { MarketingOffer } from "@/emails/MarketingOffer";
import {
  EMAIL_TEMPLATE_PURPOSE_LABELS,
  type EmailTemplatePurpose,
} from "@/lib/mektek/email-templates";
import type { BulkRecipient } from "@/lib/email";

// Marketing/offers batch sender. Driven by Vercel Cron (60s window).
// Security/anti-abuse:
//   - Opt-in enforced via UserEmailPreference (marketingOptedInAt/OffersOptedInAt
//     set AND corresponding optedOutAt null).
//   - Phone-only accounts (synthesized @phone.nextcrm.local emails) are always
//     excluded — those emails exist only to satisfy the Users.email unique
//     constraint and never receive marketing.
//   - Per-user frequency caps from UserEmailPreference.frequencyCaps vs recent
//     EmailLog count for (userId, purpose).
//   - Per-recipient unsubscribe token + List-Unsubscribe headers (RFC 8058).

const PHONE_ONLY_SUFFIX = "@phone.nextcrm.local";

type FrequencyCap = {
  // Max emails per `windowHours` hours for this purpose.
  maxPerWindow?: number;
  windowHours?: number;
};

type FrequencyCaps = {
  marketing?: FrequencyCap;
  offers?: FrequencyCap;
} | null;

const DEFAULT_CAP: FrequencyCap = { maxPerWindow: 4, windowHours: 24 * 7 }; // 4/week

function readCap(caps: FrequencyCaps, purpose: EmailTemplatePurpose): FrequencyCap {
  const entry = caps?.[purpose];
  if (!entry) return DEFAULT_CAP;
  return {
    maxPerWindow: typeof entry.maxPerWindow === "number" ? entry.maxPerWindow : DEFAULT_CAP.maxPerWindow,
    windowHours: typeof entry.windowHours === "number" ? entry.windowHours : DEFAULT_CAP.windowHours,
  };
}

async function isWithinFrequencyCap(
  userId: string,
  purpose: EmailTemplatePurpose,
  caps: FrequencyCaps
): Promise<boolean> {
  const cap = readCap(caps, purpose);
  if (!cap.maxPerWindow || cap.maxPerWindow <= 0) return true;
  const windowMs = (cap.windowHours ?? 24 * 7) * 60 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);
  const recent = await prismadb.emailLog.count({
    where: { userId, purpose, status: "sent", sentAt: { gte: since } },
  });
  return recent < cap.maxPerWindow;
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
  channel: Extract<EmailTemplatePurpose, "marketing" | "offers">
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

  for (const pref of preferences) {
    const user = pref.user;
    // Phone-only accounts never receive marketing.
    if (!user?.email || user.email.endsWith(PHONE_ONLY_SUFFIX)) {
      skipped += 1;
      continue;
    }
    const withinCap = await isWithinFrequencyCap(
      user.id,
      purpose,
      pref.frequencyCaps as FrequencyCaps
    );
    if (!withinCap) {
      skipped += 1;
      continue;
    }
    eligible.push({
      userId: user.id,
      email: user.email,
      username: user.name ?? null,
      userLanguage: user.userLanguage ?? "id",
    });
  }

  if (eligible.length === 0) {
    return { sent: 0, skipped, failed: 0 };
  }

  const subject = template.subject;
  const locale = "id";

  const sendResult = await sendBulkEmails({
    recipients: eligible,
    subject,
    purpose: channel,
    channel,
    locale,
    react: ({ recipient, unsubscribeUrl }) =>
      MarketingOffer({
        username: recipient.username ?? undefined,
        preheader: template.subject,
        title: template.name,
        bodyText: renderTemplateBody(template.body, {
          username: recipient.username ?? "",
        }),
        ctaLabel: "Selengkapnya",
        ctaUrl: process.env.NEXT_PUBLIC_APP_URL ?? "#",
        unsubscribeUrl,
        userLanguage: recipient.userLanguage ?? "id",
      }),
    text: (recipient) =>
      renderTemplateBody(template.body, { username: recipient.username ?? "" }),
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
