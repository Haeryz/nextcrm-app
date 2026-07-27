import FinanceWorkspace from "./_components/FinanceWorkspace";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const first = (key: string) => {
    const value = resolved[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  return (
    <FinanceWorkspace
      section="overview"
      overviewMonth={first("month").slice(0, 7)}
      overviewYear={first("year").slice(0, 4)}
    />
  );
}
