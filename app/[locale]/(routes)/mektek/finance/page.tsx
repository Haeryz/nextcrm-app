import FinanceWorkspace from "./_components/FinanceWorkspace";
import { requireFinanceSection } from "./_lib/gate";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "accounting");
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
