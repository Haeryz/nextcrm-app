import Container from "@/app/[locale]/(routes)/components/ui/Container";
import {
  getMektekTechnicians,
} from "@/actions/mektek/service-orders";
import { authOptions } from "@/lib/auth";
import { canCreateMektekOrders, canViewMektekOrders } from "@/lib/mektek/permissions";
import { getMektekTodayDateInput } from "@/lib/mektek/schedule";
import { getServerSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import NewServiceOrderForm from "./_components/NewServiceOrderForm";

interface MektekPageProps {
  params?: Promise<{ locale: string }>;
}

export default async function MektekPage({ params }: MektekPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  const canAccess = canViewMektekOrders(session?.user);
  const canCreate = canCreateMektekOrders(session?.user);

  if (!canAccess) {
    return (
      <Container title="Buat Pesanan" description="Buat pesanan servis MekTek baru">
        <Card className="border">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses ke ruang kerja staf MekTek.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const techniciansResult = canCreate
    ? await getMektekTechnicians()
    : { data: [] as Awaited<ReturnType<typeof getMektekTechnicians>>["data"] };
  const technicians = techniciansResult.data ?? [];

  return (
    <Container title="Buat Pesanan" description="Buat pesanan servis MekTek baru">
      <div className="space-y-6">
        {canCreate ? (
          <NewServiceOrderForm
            locale={locale}
            initialEstimatedDone={getMektekTodayDateInput()}
            technicians={technicians}
          />
        ) : (
          <Card className="border">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Hanya Admin atau CS MekTek yang dapat menambah catatan servis baru.
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}
