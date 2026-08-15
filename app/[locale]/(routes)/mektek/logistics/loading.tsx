import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container title="Monitoring PO" description="Pengiriman item MekTek kepada User">
      <ListPageSkeleton rows={8} />
    </Container>
  );
}
