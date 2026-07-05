import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth-guards";

/**
 * WhatsApp pairing exposes the QR that links a device to the business WhatsApp
 * account. The page component is a client component (no server session access),
 * so this server layout enforces the admin-only gate. Non-admin staff see an
 * explanation instead of the pairing UI.
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
        description="Business WhatsApp connection"
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
