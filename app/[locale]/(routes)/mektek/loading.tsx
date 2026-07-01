import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "./_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container
      title="MEKTEK"
      description="Service order tracking - manage and monitor all repair jobs"
    >
      <ListPageSkeleton rows={8} />
    </Container>
  );
}
