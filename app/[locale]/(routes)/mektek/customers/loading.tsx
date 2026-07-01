import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Customers"
      description="Create, update, and remove customer profiles with linked user accounts"
    >
      <ListPageSkeleton rows={6} />
    </Container>
  );
}
