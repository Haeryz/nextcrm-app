import FinanceWorkspace from "../_components/FinanceWorkspace";
import { requireFinanceSection } from "../_lib/gate";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireFinanceSection(locale, "finance");
  return <FinanceWorkspace section="approvals" />;
}
