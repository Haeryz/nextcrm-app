import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Receiving"
      description="Purchase Order MekTek ke supplier dan penerimaan barang"
    >
      <ListPageSkeleton rows={8} />
    </Container>
  );
}
