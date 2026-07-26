import {
  WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS,
  isWhatsAppMessageTemplatePurpose,
} from "@/lib/mektek/whatsapp-message-templates";

/**
 * Presentation-only constants for the send-activity panel. These cannot live in
 * `actions/mektek/whatsapp-log.ts` because a "use server" module is only allowed
 * to export async functions.
 */

export const WHATSAPP_LOG_RANGE_OPTIONS = [
  { value: 7, label: "7 hari" },
  { value: 30, label: "30 hari" },
  { value: 90, label: "90 hari" },
] as const;

export const WHATSAPP_LOG_STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "sent", label: "Terkirim" },
  { value: "failed", label: "Gagal" },
  { value: "suppressed", label: "Ditahan" },
] as const;

export const WHATSAPP_LOG_STATUS_LABELS: Record<string, string> = {
  sent: "Terkirim",
  failed: "Gagal",
  suppressed: "Ditahan",
};

export const WHATSAPP_LOG_CATEGORY_LABELS: Record<string, string> = {
  transactional: "Transaksional",
  promotional: "Promosi",
};

const jakartaDateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWhatsAppLogTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${jakartaDateTime.format(date)} WIB`;
}

/** Purposes reuse the template labels when they match a known template purpose. */
export function whatsAppPurposeLabel(purpose: string) {
  if (isWhatsAppMessageTemplatePurpose(purpose)) {
    return WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS[purpose];
  }
  return purpose.replace(/_/g, " ").toLowerCase();
}

export function whatsAppStatusLabel(status: string) {
  return WHATSAPP_LOG_STATUS_LABELS[status] ?? status;
}

export function whatsAppCategoryLabel(category: string) {
  return WHATSAPP_LOG_CATEGORY_LABELS[category] ?? category;
}

/**
 * Promotional vs transactional is the whole point of this screen — the number
 * was suspended for unsolicited promotion — so the two never share a colour.
 */
export const WHATSAPP_CATEGORY_BADGE_CLASS: Record<string, string> = {
  transactional:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  promotional:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

export const WHATSAPP_STATUS_BADGE_CLASS: Record<string, string> = {
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  failed:
    "border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20",
  suppressed:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function whatsAppCategoryBadgeClass(category: string) {
  return (
    WHATSAPP_CATEGORY_BADGE_CLASS[category] ??
    "border-muted-foreground/30 bg-muted text-muted-foreground"
  );
}

export function whatsAppStatusBadgeClass(status: string) {
  return (
    WHATSAPP_STATUS_BADGE_CLASS[status] ??
    "border-muted-foreground/30 bg-muted text-muted-foreground"
  );
}
