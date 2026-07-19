import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { CardGridSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Catalogue Items"
      description="Buat, perbarui, hapus, dan tinjau item dari parts catalogue"
    >
      <CardGridSkeleton cards={9} />
    </Container>
  );
}
