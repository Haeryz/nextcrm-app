import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Recap pages have no records of their own; a new row is created by adding the
 * invoice it derives from.
 */
export default function RecapCreateButton({
  label = "Tambah invoice",
}: {
  label?: string;
}) {
  return (
    <Button asChild size="sm">
      <Link href="/mektek/finance/invoices">{label}</Link>
    </Button>
  );
}
