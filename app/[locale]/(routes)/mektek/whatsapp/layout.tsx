import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth-guards";

/**
 * WhatsApp pairing exposes the QR that links a device to the business WhatsApp
 * account, so it is admin-only. Non-admin staff see an explanation instead of the
 * pairing UI.
 *
 * This gate is for the UI only — the routes that actually do the work
 * (/api/whatsapp/pair and /api/whatsapp/logout) re-check admin themselves rather
 * than trusting that a caller came through this page.
 */
export default async function MektekWhatsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user?.isAdmin) {
    return (
      <Container
        title="WhatsApp"
        description="Koneksi WhatsApp Business"
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only admins can pair and manage the business WhatsApp connection.
          </CardContent>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}
