import FinanceWorkspace from "../_components/FinanceWorkspace";
import { requireFinanceSection } from "../_lib/gate";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    q?: string | string[];
    classification?: string | string[];
    inspect?: string | string[];
  }>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q;
  const classification = resolvedSearchParams?.classification;
  const inspect = resolvedSearchParams?.inspect;
  return (
    <FinanceWorkspace
      section="invoices"
      query={String(Array.isArray(query) ? query[0] ?? "" : query ?? "").slice(0, 100)}
      classification={String(
        Array.isArray(classification)
          ? classification[0] ?? ""
          : classification ?? "",
      ).slice(0, 30)}
      inspectInvoiceId={String(
        Array.isArray(inspect) ? inspect[0] ?? "" : inspect ?? "",
      ).slice(0, 100)}
    />
  );
}
