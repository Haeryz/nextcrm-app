import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { CardGridSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Catalogue Items"
      description="Create, update, delete, and review items extracted from the parts catalogue"
    >
      <CardGridSkeleton cards={9} />
    </Container>
  );
}
