import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { DetailPageSkeleton } from "../../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Customer Details"
      description="Memuat detail customer dan riwayat servis…"
    >
      <DetailPageSkeleton />
    </Container>
  );
}
