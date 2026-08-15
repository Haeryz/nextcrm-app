import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { ListPageSkeleton } from "../_components/MektekSkeletons";

export default function Loading() {
  return (
    <Container title="Voucher" description="Kelola Voucher MekTek">
      <ListPageSkeleton rows={6} />
    </Container>
  );
}
