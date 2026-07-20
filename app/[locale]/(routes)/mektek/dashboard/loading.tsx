import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { DashboardSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="MEKTEK Dashboard"
      description="Ringkasan operasional, penjualan, dan pelanggan MekTek"
    >
      <DashboardSkeleton />
    </Container>
  );
}
