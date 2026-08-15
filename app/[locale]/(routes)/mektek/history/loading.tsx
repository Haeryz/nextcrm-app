import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="History"
      description="Riwayat seluruh pesanan servis MekTek"
    >
      <ListPageSkeleton rows={8} />
    </Container>
  );
}
