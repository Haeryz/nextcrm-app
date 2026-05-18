import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import ResendCard from "../_components/ResendCard";

export default async function AdminServicesPage() {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("AdminPage");

  if (!session?.user?.isAdmin) {
    return (
      <Container title="Services" description={t("accessNotAllowed")}>
        <div className="flex h-full w-full items-center justify-center">
          {t("accessNotAllowed")}
        </div>
      </Container>
    );
  }

  return (
    <Container
      title="Services"
      description="Configure shared application service integrations"
    >
      <div className="flex flex-wrap gap-4">
        <ResendCard />
      </div>
    </Container>
  );
}
