import { getTranslations } from "next-intl/server";

import "@/app/[locale]/globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const { locale } = params;

  const t = await getTranslations({ locale, namespace: "RootLayout" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background text-foreground">
      <div className="flex w-full items-center justify-end p-4 sm:p-5">
        <ThemeToggle />
      </div>
      <div className="flex w-full grow items-center justify-center px-4 pb-8">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
