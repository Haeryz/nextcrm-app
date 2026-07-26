import type { CatalogCustomerType, Prisma } from "@prisma/client";

import type { BulkRecipient } from "@/lib/email";
import type { EmailTemplatePurpose } from "@/lib/mektek/email-templates";
import { prismadb } from "@/lib/prisma";

// Audience resolution for Mektek promotional email.
//
// `lib/email.ts` (sendBulkEmails) enforces NEITHER opt-out NOR BlockedEmailDomain
// — it only chunks, issues unsubscribe tokens and logs. Every suppression rule
// therefore lives HERE, in the caller, and any new send path must go through
// `resolveEmailAudience` or it will bypass consent.
//
// Suppression applied here, in order:
//   1. Opt-in required + opt-out absent (per channel) via UserEmailPreference.
//   2. Staff/admin accounts excluded (is_admin / mektekRole / staffDivision).
//   3. Non-ACTIVE users excluded.
//   4. Walk-ins excluded — a CatalogCustomer with userId = null has no account,
//      no email and no way to consent or unsubscribe.
//   5. Synthesized phone-only addresses (@phone.nextcrm.local) excluded.
//   6. Addresses whose domain is in BlockedEmailDomain excluded.
//   7. Per-user frequency cap (default 4 per 7 days) from UserEmailPreference.

export const PHONE_ONLY_EMAIL_SUFFIX = "@phone.nextcrm.local";

// Mirrors MektekVoucherScope (prisma/schema.prisma) so campaign targeting and
// voucher targeting stay conceptually identical for the admin.
export const MEKTEK_EMAIL_AUDIENCE_SCOPES = [
  "ALL",
  "CUSTOMER_TYPE",
  "CUSTOMER",
] as const;

export type MektekEmailAudienceScope =
  (typeof MEKTEK_EMAIL_AUDIENCE_SCOPES)[number];

// CatalogCustomerType has exactly these two values in prisma/schema.prisma.
export const MEKTEK_EMAIL_CUSTOMER_TYPES = ["STANDARD", "B2B"] as const;

export const MEKTEK_EMAIL_CUSTOMER_TYPE_LABELS: Record<
  CatalogCustomerType,
  string
> = {
  STANDARD: "Customer standard",
  B2B: "Customer perusahaan (B2B)",
};

export const MEKTEK_EMAIL_AUDIENCE_SCOPE_LABELS: Record<
  MektekEmailAudienceScope,
  string
> = {
  ALL: "Semua Customer",
  CUSTOMER_TYPE: "Berdasarkan tipe Customer",
  CUSTOMER: "Satu Customer",
};

/**
 * Hard cap per invocation. Vercel route handlers here run with
 * `maxDuration = 60` and sendBulkEmails walks chunks of 50 serially, so a large
 * audience WILL time out mid-batch. We stop at this many recipients per send and
 * report `remaining` so the admin can run the campaign again instead of being
 * told a truncated send "completed".
 */
export const MAX_RECIPIENTS_PER_SEND = 200;

/**
 * Upper bound on how many candidate rows we pull into memory for one preview or
 * send. Anything beyond this is reported as `remaining` (unscanned), never
 * silently dropped.
 */
export const AUDIENCE_SCAN_LIMIT = 2_000;

export type EmailCampaignChannel = Extract<
  EmailTemplatePurpose,
  "marketing" | "offers"
>;

export type MektekEmailAudience = {
  scope: MektekEmailAudienceScope;
  customerType: CatalogCustomerType | null;
  customerId: string | null;
};

export type MektekEmailAudienceInput = {
  scope?: unknown;
  customerType?: unknown;
  customerId?: unknown;
};

export function isMektekEmailAudienceScope(
  value: unknown,
): value is MektekEmailAudienceScope {
  return MEKTEK_EMAIL_AUDIENCE_SCOPES.includes(
    value as MektekEmailAudienceScope,
  );
}

export function isMektekEmailCustomerType(
  value: unknown,
): value is CatalogCustomerType {
  return MEKTEK_EMAIL_CUSTOMER_TYPES.includes(value as CatalogCustomerType);
}

export function validateMektekEmailAudience(
  input: MektekEmailAudienceInput | undefined,
): { data: MektekEmailAudience } | { error: string } {
  const scope = input?.scope;
  if (!isMektekEmailAudienceScope(scope)) {
    return { error: "Target penerima tidak valid" };
  }

  if (scope === "CUSTOMER_TYPE") {
    if (!isMektekEmailCustomerType(input?.customerType)) {
      return { error: "Tipe Customer wajib dipilih" };
    }
    return {
      data: { scope, customerType: input?.customerType, customerId: null },
    };
  }

  if (scope === "CUSTOMER") {
    const customerId = String(input?.customerId ?? "").trim();
    if (!customerId) return { error: "Customer tujuan wajib dipilih" };
    return { data: { scope, customerType: null, customerId } };
  }

  return { data: { scope: "ALL", customerType: null, customerId: null } };
}

export function describeMektekEmailAudience(
  audience: MektekEmailAudience,
  customerLabel?: string | null,
): string {
  if (audience.scope === "CUSTOMER") {
    return `Satu Customer: ${customerLabel?.trim() || audience.customerId || "-"}`;
  }
  if (audience.scope === "CUSTOMER_TYPE") {
    const type = audience.customerType;
    return `Tipe Customer: ${type ? MEKTEK_EMAIL_CUSTOMER_TYPE_LABELS[type] : "-"}`;
  }
  return "Semua Customer yang berlangganan";
}

/**
 * The eligibility predicate.
 *
 * `user: { is: { ... } }` (not a bare `user: { ... }`) is deliberate: a bare
 * relation filter on a nullable to-one relation would also match rows where the
 * relation is absent, which would sweep in every walk-in CatalogCustomer
 * (userId = null). `is` forces the relation to exist AND match.
 */
export function buildEmailAudienceWhere(
  audience: MektekEmailAudience,
  channel: EmailCampaignChannel,
): Prisma.CatalogCustomerWhereInput {
  // Written out per channel rather than with computed keys so the Prisma input
  // type is actually checked.
  const emailPreference: Prisma.UserEmailPreferenceWhereInput =
    channel === "marketing"
      ? { marketingOptedInAt: { not: null }, marketingOptedOutAt: null }
      : { offersOptedInAt: { not: null }, offersOptedOutAt: null };

  const scopeWhere: Prisma.CatalogCustomerWhereInput =
    audience.scope === "CUSTOMER"
      ? { id: audience.customerId ?? "" }
      : audience.scope === "CUSTOMER_TYPE" && audience.customerType
        ? { customerType: audience.customerType }
        : {};

  return {
    ...scopeWhere,
    user: {
      is: {
        userStatus: "ACTIVE",
        is_admin: false,
        mektekRole: null,
        staffDivision: null,
        logisticsStaffArea: null,
        NOT: { email: { endsWith: PHONE_ONLY_EMAIL_SUFFIX } },
        emailPreference: { is: emailPreference },
      },
    },
  };
}

type FrequencyCap = {
  maxPerWindow?: number;
  windowHours?: number;
};

export type FrequencyCaps = {
  marketing?: FrequencyCap;
  offers?: FrequencyCap;
} | null;

export const DEFAULT_FREQUENCY_CAP: Required<FrequencyCap> = {
  maxPerWindow: 4,
  windowHours: 24 * 7,
}; // 4 per week

export function readFrequencyCap(
  caps: FrequencyCaps,
  purpose: EmailTemplatePurpose,
): Required<FrequencyCap> {
  const entry = caps?.[purpose as keyof NonNullable<FrequencyCaps>];
  if (!entry) return DEFAULT_FREQUENCY_CAP;
  return {
    maxPerWindow:
      typeof entry.maxPerWindow === "number"
        ? entry.maxPerWindow
        : DEFAULT_FREQUENCY_CAP.maxPerWindow,
    windowHours:
      typeof entry.windowHours === "number"
        ? entry.windowHours
        : DEFAULT_FREQUENCY_CAP.windowHours,
  };
}

/** Single-user cap check. Kept for the legacy cron batch path. */
export async function isWithinFrequencyCap(
  userId: string,
  purpose: EmailTemplatePurpose,
  caps: FrequencyCaps,
): Promise<boolean> {
  const cap = readFrequencyCap(caps, purpose);
  if (!cap.maxPerWindow || cap.maxPerWindow <= 0) return true;
  const since = new Date(Date.now() - cap.windowHours * 60 * 60 * 1000);
  const recent = await prismadb.emailLog.count({
    where: { userId, purpose, status: "sent", sentAt: { gte: since } },
  });
  return recent < cap.maxPerWindow;
}

type CapCandidate = { userId: string; caps: FrequencyCaps };

/**
 * Batched cap check. Buckets candidates by their cap window and issues one
 * `groupBy` aggregate per bucket (almost always exactly one, because
 * `frequencyCaps` is null for nearly every user) instead of one COUNT per user.
 */
export async function filterByFrequencyCap(
  candidates: CapCandidate[],
  purpose: EmailTemplatePurpose,
): Promise<Set<string>> {
  const allowed = new Set<string>();
  // windowHours -> [{ userId, maxPerWindow }]
  const buckets = new Map<
    number,
    Array<{ userId: string; maxPerWindow: number }>
  >();

  for (const candidate of candidates) {
    const cap = readFrequencyCap(candidate.caps, purpose);
    if (!cap.maxPerWindow || cap.maxPerWindow <= 0) {
      // Cap disabled for this user — always allowed.
      allowed.add(candidate.userId);
      continue;
    }
    const bucket = buckets.get(cap.windowHours) ?? [];
    bucket.push({ userId: candidate.userId, maxPerWindow: cap.maxPerWindow });
    buckets.set(cap.windowHours, bucket);
  }

  for (const [windowHours, entries] of buckets) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const grouped = await prismadb.emailLog.groupBy({
      by: ["userId"],
      where: {
        userId: { in: entries.map((entry) => entry.userId) },
        purpose,
        status: "sent",
        sentAt: { gte: since },
      },
      _count: { _all: true },
    });

    const sentCounts = new Map<string, number>();
    for (const row of grouped) {
      if (row.userId) sentCounts.set(row.userId, row._count._all);
    }

    for (const entry of entries) {
      if ((sentCounts.get(entry.userId) ?? 0) < entry.maxPerWindow) {
        allowed.add(entry.userId);
      }
    }
  }

  return allowed;
}

export function emailDomainOf(email: string): string | null {
  const normalized = String(email ?? "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return null;
  const domain = normalized.slice(at + 1);
  return domain || null;
}

export async function loadBlockedEmailDomains(): Promise<Set<string>> {
  const rows = await prismadb.blockedEmailDomain.findMany({
    select: { domain: true },
  });
  return new Set(rows.map((row) => row.domain.trim().toLowerCase()));
}

export type AudienceSkipReasons = {
  /** Missing/malformed address, or a synthesized @phone.nextcrm.local one. */
  invalidEmail: number;
  /** Domain listed in BlockedEmailDomain (manual block or 3+ bounces). */
  blockedDomain: number;
  /** Already at the per-user frequency cap for this purpose. */
  frequencyCap: number;
};

export type AudienceSummary = {
  /** Rows matching scope + opt-in predicate, straight from the DB. */
  matched: number;
  /** Rows we actually inspected (bounded by AUDIENCE_SCAN_LIMIT). */
  scanned: number;
  /** Deliverable right now, after every suppression rule. */
  eligible: number;
  /** matched - eligible: suppressed or not scanned. */
  skipped: number;
  reasons: AudienceSkipReasons;
  /** How many this invocation will actually attempt. */
  sendableNow: number;
  /** Eligible-but-deferred + unscanned. > 0 means "run it again". */
  remaining: number;
  limit: number;
};

export type ResolvedEmailAudience = AudienceSummary & {
  recipients: BulkRecipient[];
};

export async function resolveEmailAudience(args: {
  audience: MektekEmailAudience;
  channel: EmailCampaignChannel;
  /** Frequency-cap bucket. Defaults to the channel. */
  purpose?: EmailTemplatePurpose;
  limit?: number;
}): Promise<ResolvedEmailAudience> {
  const purpose = args.purpose ?? args.channel;
  const limit = Math.max(
    1,
    Math.min(args.limit ?? MAX_RECIPIENTS_PER_SEND, MAX_RECIPIENTS_PER_SEND),
  );
  const where = buildEmailAudienceWhere(args.audience, args.channel);

  const [matched, customers, blockedDomains] = await Promise.all([
    prismadb.catalogCustomer.count({ where }),
    prismadb.catalogCustomer.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: AUDIENCE_SCAN_LIMIT,
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            userLanguage: true,
            emailPreference: { select: { frequencyCaps: true } },
          },
        },
      },
    }),
    loadBlockedEmailDomains(),
  ]);

  const reasons: AudienceSkipReasons = {
    invalidEmail: 0,
    blockedDomain: 0,
    frequencyCap: 0,
  };

  const survivors: Array<{ recipient: BulkRecipient; caps: FrequencyCaps }> = [];
  const seenUserIds = new Set<string>();

  for (const customer of customers) {
    const user = customer.user;
    // `user: { is: ... }` already excludes walk-ins; this is belt-and-braces so
    // a future query change can never leak a null-user row into a send.
    if (!user?.id) {
      reasons.invalidEmail += 1;
      continue;
    }
    const email = String(user.email ?? "").trim();
    const domain = emailDomainOf(email);
    if (!email || !domain || email.endsWith(PHONE_ONLY_EMAIL_SUFFIX)) {
      reasons.invalidEmail += 1;
      continue;
    }
    if (blockedDomains.has(domain)) {
      reasons.blockedDomain += 1;
      continue;
    }
    // A Users row can only own one CatalogCustomer (userId is @unique), but
    // dedupe anyway so nobody can ever receive the same campaign twice.
    if (seenUserIds.has(user.id)) continue;
    seenUserIds.add(user.id);

    survivors.push({
      recipient: {
        userId: user.id,
        email,
        username: user.name ?? null,
        userLanguage: user.userLanguage ?? "id",
      },
      caps: (user.emailPreference?.frequencyCaps ?? null) as FrequencyCaps,
    });
  }

  const withinCap = await filterByFrequencyCap(
    survivors.map((entry) => ({ userId: entry.recipient.userId, caps: entry.caps })),
    purpose,
  );

  const eligibleRecipients: BulkRecipient[] = [];
  for (const entry of survivors) {
    if (!withinCap.has(entry.recipient.userId)) {
      reasons.frequencyCap += 1;
      continue;
    }
    eligibleRecipients.push(entry.recipient);
  }

  const eligible = eligibleRecipients.length;
  const recipients = eligibleRecipients.slice(0, limit);
  const unscanned = Math.max(0, matched - customers.length);

  return {
    matched,
    scanned: customers.length,
    eligible,
    skipped: Math.max(0, matched - eligible),
    reasons,
    sendableNow: recipients.length,
    remaining: Math.max(0, eligible - recipients.length) + unscanned,
    limit,
    recipients,
  };
}

/**
 * Recipient count preview. Same resolution path as the real send (so the number
 * the admin confirms is the number that will be attempted), minus the addresses.
 */
export async function countAudience(args: {
  audience: MektekEmailAudience;
  channel: EmailCampaignChannel;
  purpose?: EmailTemplatePurpose;
  limit?: number;
}): Promise<AudienceSummary> {
  const { recipients: _recipients, ...summary } = await resolveEmailAudience(args);
  void _recipients;
  return summary;
}

/** Bahasa Indonesia explanation of why an audience resolved to zero recipients. */
export function explainEmptyAudience(summary: AudienceSummary): string {
  if (summary.matched === 0) {
    return (
      "Tidak ada Customer yang cocok dengan target ini. " +
      "Penerima harus punya akun (bukan Customer walk-in), berstatus aktif, " +
      "bukan staf/admin, punya alamat email asli, dan sudah menyetujui " +
      "(opt-in) email promosi. Saat ini daftar opt-in tersebut kosong."
    );
  }
  const parts: string[] = [];
  if (summary.reasons.frequencyCap > 0) {
    parts.push(
      `${summary.reasons.frequencyCap} sudah mencapai batas frekuensi kirim`,
    );
  }
  if (summary.reasons.blockedDomain > 0) {
    parts.push(`${summary.reasons.blockedDomain} domain email diblokir`);
  }
  if (summary.reasons.invalidEmail > 0) {
    parts.push(`${summary.reasons.invalidEmail} alamat email tidak valid`);
  }
  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  return `${summary.matched} Customer cocok dengan target, tetapi semuanya tersaring${detail}. Tidak ada email yang dikirim.`;
}
