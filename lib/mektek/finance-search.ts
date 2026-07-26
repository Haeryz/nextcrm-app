/**
 * Shared matching rules for the Finance/Accounting recap filters.
 *
 * A query is split into terms. Every term must be found, but the terms may
 * land in different fields, so "pt maju 123/PO" matches the row whose customer
 * is PT Maju and whose PO number is 123/PO/VII/2026. Wrap a term in double
 * quotes to match it as a single phrase.
 */

/** Splits a report query into the individual terms used for matching. */
export function reportQueryTerms(query: string) {
  return (query.trim().toLocaleLowerCase("id-ID").match(/"[^"]+"|\S+/g) ?? [])
    .map((term) => term.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

export function matchesReportQuery(query: string, ...values: Array<unknown>) {
  const terms = reportQueryTerms(query);
  if (!terms.length) return true;
  const haystack = values
    .map((value) => String(value ?? "").toLocaleLowerCase("id-ID"))
    .join("  ");
  return terms.every((term) => haystack.includes(term));
}
