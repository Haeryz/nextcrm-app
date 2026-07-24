import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { listMektekEmailTemplates } from "@/actions/mektek/email-templates";
import EmailTemplateManager from "./_components/EmailTemplateManager";

export const dynamic = "force-dynamic";

// Admin gating lives in ./layout.tsx — this page only renders what that gate
// already allowed through. Server component so templates load straight from
// the DB on first paint (no client flash).
export default async function MektekEmailPage() {
  const templatesResult = await listMektekEmailTemplates();

  return (
    <Container
      title="MEKTEK — Email"
      description="Template email marketing & penawaran untuk pelanggan"
    >
      <EmailTemplateManager initialTemplates={templatesResult.data ?? []} />
    </Container>
  );
}
