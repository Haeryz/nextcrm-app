import FinanceWorkspace from "../_components/FinanceWorkspace";
import { requireFinanceSection } from "../_lib/gate";
import { parseFinancePeriodParams } from "../_lib/period-filter";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
  const resolved = await searchParams;
  const queryValue = resolved?.q;
  const query = String(
    Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "",
  ).slice(0, 100);
  const period = parseFinancePeriodParams(resolved);
  return (
    <FinanceWorkspace
      section="revenue"
      query={query}
      period={period}
    />
  );
}
