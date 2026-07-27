import FinanceWorkspace from "../_components/FinanceWorkspace";
import { requireFinanceSection } from "../_lib/gate";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
  const query = (await searchParams)?.q;
  return (
    <FinanceWorkspace
      section="receivables"
      query={String(Array.isArray(query) ? query[0] ?? "" : query ?? "").slice(0, 100)}
    />
  );
}
