import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { listMektekWhatsAppMessageTemplates } from "@/actions/mektek/whatsapp-message-templates";
import { listWhatsAppSendActivity } from "@/actions/mektek/whatsapp-log";
import { getWhatsAppState } from "@/lib/whatsapp";
import WhatsAppPairingPanel from "./_components/WhatsAppPairingPanel";
import WhatsAppSendActivityPanel from "./_components/WhatsAppSendActivityPanel";

export const dynamic = "force-dynamic";

// Server component so the session state is read straight from the database on the
// way in. The client component then has the right state on first paint, instead of
// flashing "Belum terhubung" while an initial fetch resolves.
//
// Admin gating lives in ./layout.tsx — this page only renders what that already
// allowed through.
export default async function MektekWhatsAppPage() {
  const [state, templatesResult, activityResult] = await Promise.all([
    getWhatsAppState(),
    listMektekWhatsAppMessageTemplates(),
    listWhatsAppSendActivity({ days: 30, page: 1 }),
  ]);

  return (
    <Container
      title="MEKTEK — WhatsApp"
      description="Konfigurasi integrasi WhatsApp untuk notifikasi pelanggan"
    >
      <div className="space-y-6">
        <WhatsAppPairingPanel
          initialStatus={state.status === "ready" ? "connected" : "disconnected"}
          initialPhone={state.sessionPhone ?? null}
          initialError={state.lastError ?? null}
          initialTemplates={templatesResult.data ?? []}
        />
        <WhatsAppSendActivityPanel
          initialData={activityResult.data ?? null}
          initialError={"error" in activityResult ? activityResult.error : null}
        />
      </div>
    </Container>
  );
}
