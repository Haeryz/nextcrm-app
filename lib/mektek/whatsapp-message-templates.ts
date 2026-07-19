export const WHATSAPP_MESSAGE_TEMPLATE_PURPOSES = [
  "ORDER_CREATED",
  "READY_FOR_PAYMENT",
  "ORDER_COMPLETED",
] as const;

export type WhatsAppMessageTemplatePurpose =
  (typeof WHATSAPP_MESSAGE_TEMPLATE_PURPOSES)[number];

export const WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS: Record<
  WhatsAppMessageTemplatePurpose,
  string
> = {
  ORDER_CREATED: "Order baru",
  READY_FOR_PAYMENT: "Siap dibayar",
  ORDER_COMPLETED: "Servis selesai",
};

export type WhatsAppMessageTemplateInput = {
  name?: unknown;
  body?: unknown;
  purpose?: unknown;
  isActive?: unknown;
};

const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_TEMPLATE_BODY_LENGTH = 4_000;

export function isWhatsAppMessageTemplatePurpose(
  value: unknown,
): value is WhatsAppMessageTemplatePurpose {
  return WHATSAPP_MESSAGE_TEMPLATE_PURPOSES.includes(
    value as WhatsAppMessageTemplatePurpose,
  );
}

export function validateWhatsAppMessageTemplateInput(
  input: WhatsAppMessageTemplateInput,
) {
  const name = String(input?.name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEMPLATE_NAME_LENGTH);
  const body = String(input?.body ?? "").trim().slice(0, MAX_TEMPLATE_BODY_LENGTH);
  const purpose = input?.purpose;

  if (!name) return { error: "Nama template wajib diisi" } as const;
  if (!body) return { error: "Isi template wajib diisi" } as const;
  if (!isWhatsAppMessageTemplatePurpose(purpose)) {
    return { error: "Jenis template tidak valid" } as const;
  }

  return {
    data: {
      name,
      body,
      purpose,
      isActive: input?.isActive === true,
    },
  } as const;
}

export function applyWhatsAppMessageTemplate(
  template: string,
  context: Record<string, string>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => context[key] ?? "");
}
