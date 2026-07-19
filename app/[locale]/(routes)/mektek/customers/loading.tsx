import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="Customers"
      description="Buat, perbarui, dan hapus Customer Profile beserta User Account yang terhubung"
    >
      <ListPageSkeleton rows={6} />
    </Container>
  );
}
