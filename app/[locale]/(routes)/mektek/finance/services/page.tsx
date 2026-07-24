import FinanceWorkspace from "../_components/FinanceWorkspace";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const query = (await searchParams)?.q;
  return (
    <FinanceWorkspace
      section="services"
      query={String(Array.isArray(query) ? query[0] ?? "" : query ?? "").slice(0, 100)}
    />
  );
}
