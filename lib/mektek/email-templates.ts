export const EMAIL_TEMPLATE_PURPOSES = ["marketing", "offers"] as const;

export type EmailTemplatePurpose = (typeof EMAIL_TEMPLATE_PURPOSES)[number];

export const EMAIL_TEMPLATE_PURPOSE_LABELS: Record<
  EmailTemplatePurpose,
  string
> = {
  marketing: "Email Pemasaran",
  offers: "Email Penawaran",
};

export type MektekEmailTemplateInput = {
  name?: unknown;
  subject?: unknown;
  body?: unknown;
  purpose?: unknown;
  isActive?: unknown;
};

const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_TEMPLATE_SUBJECT_LENGTH = 200;
const MAX_TEMPLATE_BODY_LENGTH = 5_000;

export function isEmailTemplatePurpose(
  value: unknown,
): value is EmailTemplatePurpose {
  return EMAIL_TEMPLATE_PURPOSES.includes(value as EmailTemplatePurpose);
}

export function validateMektekEmailTemplateInput(
  input: MektekEmailTemplateInput,
) {
  const name = String(input?.name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEMPLATE_NAME_LENGTH);
  const subject = String(input?.subject ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEMPLATE_SUBJECT_LENGTH);
  const body = String(input?.body ?? "")
    .trim()
    .slice(0, MAX_TEMPLATE_BODY_LENGTH);
  const purpose = input?.purpose;

  if (!name) return { error: "Nama template wajib diisi" } as const;
  if (!subject) return { error: "Subjek template wajib diisi" } as const;
  if (!body) return { error: "Isi template wajib diisi" } as const;
  if (!isEmailTemplatePurpose(purpose)) {
    return { error: "Jenis template tidak valid" } as const;
  }

  return {
    data: {
      name,
      subject,
      body,
      purpose,
      isActive: input?.isActive === true,
    },
  } as const;
}
