import FinanceWorkspace from "../_components/FinanceWorkspace";
import { requireFinanceSection } from "../_lib/gate";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
  const resolved = await searchParams;
  const pageValue = resolved?.page;
  const requestedPage = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const deliveryNotesPage = Math.max(Number(requestedPage) || 1, 1);
  const queryValue = resolved?.q;
  const query = String(
    Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "",
  ).slice(0, 100);

  return (
    <FinanceWorkspace
      section="delivery-notes"
      deliveryNotesPage={deliveryNotesPage}
      query={query}
    />
  );
}
