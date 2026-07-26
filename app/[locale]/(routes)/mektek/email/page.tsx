import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { listMektekEmailCampaignHistory } from "@/actions/mektek/email-campaigns";
import { listMektekEmailTemplates } from "@/actions/mektek/email-templates";
import EmailCampaignComposer from "./_components/EmailCampaignComposer";
import EmailSendHistory from "./_components/EmailSendHistory";
import EmailTemplateManager from "./_components/EmailTemplateManager";

export const dynamic = "force-dynamic";

// Admin gating lives in ./layout.tsx — this page only renders what that gate
// already allowed through. Server component so templates load straight from
// the DB on first paint (no client flash).
export default async function MektekEmailPage() {
  const [templatesResult, historyResult] = await Promise.all([
    listMektekEmailTemplates(),
    listMektekEmailCampaignHistory(),
  ]);

  const templates = "data" in templatesResult ? (templatesResult.data ?? []) : [];
  const history = "data" in historyResult ? (historyResult.data ?? []) : [];

  return (
    <Container
      title="MEKTEK — Email"
      description="Kampanye dan template email promosi untuk pelanggan"
    >
      <div className="space-y-6">
        <EmailCampaignComposer templates={templates} />
        <EmailSendHistory rows={history} />
        <EmailTemplateManager initialTemplates={templates} />
      </div>
    </Container>
  );
}
