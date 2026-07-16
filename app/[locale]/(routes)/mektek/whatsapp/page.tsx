import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { getWhatsAppState } from "@/lib/whatsapp";
import WhatsAppPairingPanel from "./_components/WhatsAppPairingPanel";

export const dynamic = "force-dynamic";

// Server component so the session state is read straight from the database on the
// way in. The client component then has the right state on first paint, instead of
// flashing "Belum terhubung" while an initial fetch resolves.
//
// Admin gating lives in ./layout.tsx — this page only renders what that already
// allowed through.
export default async function MektekWhatsAppPage() {
  const state = await getWhatsAppState();

  return (
    <Container
      title="MEKTEK — WhatsApp"
      description="Konfigurasi integrasi WhatsApp untuk notifikasi pelanggan"
    >
      <WhatsAppPairingPanel
        initialStatus={state.status === "ready" ? "connected" : "disconnected"}
        initialPhone={state.sessionPhone ?? null}
        initialError={state.lastError ?? null}
      />
    </Container>
  );
}
