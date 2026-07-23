import FinanceWorkspace from "../_components/FinanceWorkspace";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const pageValue = resolved?.page;
  const requestedPage = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const deliveryNotesPage = Math.max(Number(requestedPage) || 1, 1);

  return (
    <FinanceWorkspace
      section="delivery-notes"
      deliveryNotesPage={deliveryNotesPage}
    />
  );
}
