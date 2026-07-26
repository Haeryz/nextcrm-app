"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteFinanceInvoiceEntry } from "@/actions/mektek/finance";
import { Button } from "@/components/ui/button";

/**
 * Every recap in Accounting is derived from an invoice, so editing or removing
 * a recap row means acting on that invoice. Editing deep-links into the
 * invoice dialog rather than duplicating the form on each recap page.
 */
export default function RecapRowActions({
  invoiceId,
  label,
}: {
  invoiceId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (
      !window.confirm(
        `Hapus invoice ${label}? Baris rekap yang berasal dari invoice ini ikut terhapus.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteFinanceInvoiceEntry(invoiceId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Invoice dihapus");
      router.refresh();
    });
  };

  return (
    <div className="flex justify-end gap-1">
      <Button asChild variant="outline" size="sm">
        <Link href={`../invoices?inspect=${encodeURIComponent(invoiceId)}`}>
          Ubah
        </Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
        Hapus
      </Button>
    </div>
  );
}
