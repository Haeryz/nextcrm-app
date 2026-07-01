import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { WhatsAppSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="MEKTEK — WhatsApp"
      description="Konfigurasi integrasi WhatsApp untuk notifikasi pelanggan"
    >
      <WhatsAppSkeleton />
    </Container>
  );
}
