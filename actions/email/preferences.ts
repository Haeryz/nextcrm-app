"use server";

import { prismadb } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import {
  consumeUnsubscribeToken,
  type UnsubscribeChannel,
} from "@/lib/email/unsubscribe";
import { isUnsubscribeChannel } from "@/lib/email/unsubscribe";

// Preferences + token-based unsubscribe. Transactional email (OTP/password
// reset) is NEVER gated here — only marketing/offers channels.

export type EmailPreference = {
  marketingOptedInAt: Date | null;
  offersOptedInAt: Date | null;
  marketingOptedOutAt: Date | null;
  offersOptedOutAt: Date | null;
};

export async function getEmailPreference(
  userId: string
): Promise<EmailPreference | null> {
  const row = await prismadb.userEmailPreference.findUnique({
    where: { userId },
    select: {
      marketingOptedInAt: true,
      offersOptedInAt: true,
      marketingOptedOutAt: true,
      offersOptedOutAt: true,
    },
  });
  return row ?? null;
}

export type UpdateEmailPreferenceInput = {
  marketing?: boolean;
  offers?: boolean;
};

// Authenticated opt-in/out. Used by the in-app preferences page. Setting a
// channel true records an opt-in timestamp + clears the corresponding
// opt-out timestamp; false does the reverse.
export async function updateEmailPreference(
  userId: string,
  input: UpdateEmailPreferenceInput
): Promise<{ success?: true; error?: string }> {
  if (!(await hasTrustedMutationOrigin())) {
    return { error: "Request tidak dapat diverifikasi" };
  }

  // Session user must match the userId being mutated.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== userId) {
    return { error: "Tidak memiliki izin" };
  }

  const now = new Date();
  const data: {
    marketingOptedInAt?: Date | null;
    marketingOptedOutAt?: Date | null;
    offersOptedInAt?: Date | null;
    offersOptedOutAt?: Date | null;
  } = {};

  if (typeof input.marketing === "boolean") {
    if (input.marketing) {
      data.marketingOptedInAt = now;
      data.marketingOptedOutAt = null;
    } else {
      data.marketingOptedOutAt = now;
      data.marketingOptedInAt = null;
    }
  }
  if (typeof input.offers === "boolean") {
    if (input.offers) {
      data.offersOptedInAt = now;
      data.offersOptedOutAt = null;
    } else {
      data.offersOptedOutAt = now;
      data.offersOptedInAt = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return { success: true };
  }

  try {
    await prismadb.userEmailPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_EMAIL_PREFERENCE]", error);
    return { error: "Gagal memperbarui preferensi" };
  }
}

// Token-based unsubscribe — called from the unsubscribe confirm page and the
// RFC 8058 one-click POST handler. No session required because the single-use
// token IS the proof of intent. Channel "all" opts out of both marketing and
// offers in one click.
export async function unsubscribeByToken(
  token: string,
  channel: UnsubscribeChannel
): Promise<{ success?: true; error?: string; userId?: string }> {
  if (!(await hasTrustedMutationOrigin())) {
    // RFC 8058 one-click POSTs come from Gmail/Yahoo servers, not the browser.
    // They carry no Origin header, so the trusted-origin check fails. The
    // route handler must call the internal helper instead of this action for
    // one-click. Browser confirm posts DO carry Origin.
    return { error: "Request tidak dapat diverifikasi" };
  }
  return unsubscribeByTokenInternal(token, channel);
}

// Internal — no origin check. Used by the one-click POST handler (which is
// cross-origin by design) and by the browser confirm action (which has
// already passed the trusted-origin check above).
export async function unsubscribeByTokenInternal(
  token: string,
  channel: UnsubscribeChannel
): Promise<{ success?: true; error?: string; userId?: string }> {
  if (!isUnsubscribeChannel(channel)) {
    return { error: "Channel tidak valid" };
  }

  const claimed = await consumeUnsubscribeToken(token);
  if (!claimed) {
    return { error: "Token tidak valid atau sudah digunakan" };
  }

  const now = new Date();
  const data: {
    marketingOptedOutAt?: Date;
    offersOptedOutAt?: Date;
    marketingOptedInAt?: null;
    offersOptedInAt?: null;
  } = {};

  if (channel === "marketing" || channel === "all") {
    data.marketingOptedOutAt = now;
    data.marketingOptedInAt = null;
  }
  if (channel === "offers" || channel === "all") {
    data.offersOptedOutAt = now;
    data.offersOptedInAt = null;
  }

  try {
    await prismadb.userEmailPreference.upsert({
      where: { userId: claimed.userId },
      create: { userId: claimed.userId, ...data },
      update: data,
    });
  } catch (error) {
    console.error("[UNSUBSCRIBE_BY_TOKEN]", error);
    return { error: "Gagal memperbarui preferensi" };
  }

  return { success: true, userId: claimed.userId };
}
