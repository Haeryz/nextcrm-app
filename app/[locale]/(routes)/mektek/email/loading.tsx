import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="MEKTEK — Email"
      description="Kampanye dan template email promosi untuk pelanggan"
    >
      <ListPageSkeleton rows={6} />
    </Container>
  );
}
