import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth-guards";

// Email templates drive bulk sends to customers, so CRUD is admin-only.
// Non-admin staff see an explanation instead of the manager UI.
//
// This gate is for the UI only — the server actions re-check admin themselves
// (ensureEmailTemplateAdmin), so a caller that bypasses this page still can't
// mutate templates.
export default async function MektekEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user?.isAdmin) {
    return (
      <Container title="Email" description="Template email marketing & penawaran">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only admins can manage email templates.
          </CardContent>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}
