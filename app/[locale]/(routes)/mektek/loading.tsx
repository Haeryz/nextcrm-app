import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "./_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="MEKTEK"
      description="Kelola dan pantau seluruh pekerjaan servis"
    >
      <ListPageSkeleton rows={8} />
    </Container>
  );
}
