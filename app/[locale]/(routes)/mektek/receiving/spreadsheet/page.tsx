import { redirect } from "next/navigation";

interface ReceivingSpreadsheetRedirectProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReceivingSpreadsheetRedirect({
  params,
  searchParams,
}: ReceivingSpreadsheetRedirectProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) query.set(key, firstValue);
  }

  const suffix = query.toString();
  redirect(`/${locale}/mektek/receiving${suffix ? `?${suffix}` : ""}`);
}
