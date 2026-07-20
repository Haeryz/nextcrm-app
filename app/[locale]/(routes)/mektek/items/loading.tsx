import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { CatalogInventorySkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Catalogue Items"
      description="Kelola data sparepart dan stok Gudang Belakang/Depan per bulan"
    >
      <CatalogInventorySkeleton />
    </Container>
  );
}
