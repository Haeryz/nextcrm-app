const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export function getSafeCustomerReturnPath(
  candidate: unknown,
  locale: string,
): string {
  const safeLocale = localePattern.test(locale) ? locale : "en";
  const fallback = `/${safeLocale}/customer/profile`;
  const raw = String(candidate ?? "").trim();

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }

  try {
    const base = "https://customer-return.invalid";
    const parsed = new URL(raw, base);
    const customerRoot = `/${safeLocale}/customer`;

    if (parsed.origin !== base) return fallback;
    if (
      parsed.pathname !== customerRoot &&
      !parsed.pathname.startsWith(`${customerRoot}/`)
    ) {
      return fallback;
    }
    if (
      parsed.pathname === `${customerRoot}/access` ||
      parsed.pathname.startsWith(`${customerRoot}/access/`)
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
