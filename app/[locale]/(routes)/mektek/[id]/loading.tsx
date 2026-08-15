import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { DetailPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Pesanan Servis"
      description="Memuat detail pesanan servis MekTek…"
    >
      <DetailPageSkeleton />
    </Container>
  );
}
