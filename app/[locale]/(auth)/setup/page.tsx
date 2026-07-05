import { redirect } from "next/navigation";

import { adminAccountExists } from "@/actions/auth/bootstrap-admin";
import { SetupComponent } from "./components/SetupComponent";

interface SetupPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SetupPage({ params }: SetupPageProps) {
  const { locale } = await params;

  // Self-disabling: once the owner account exists there is nothing to set up.
  if (await adminAccountExists()) {
    redirect(`/${locale}/sign-in`);
  }

  return <SetupComponent locale={locale} />;
}
