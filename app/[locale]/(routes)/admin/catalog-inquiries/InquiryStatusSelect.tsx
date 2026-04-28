"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateCatalogInquiryStatus } from "@/actions/catalog/admin";

const statuses = ["NEW", "CONTACTED", "CLOSED"];

export default function InquiryStatusSelect({
  inquiryId,
  status,
}: {
  inquiryId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(nextStatus: string) {
    startTransition(async () => {
      const result = await updateCatalogInquiryStatus({
        inquiryId,
        status: nextStatus,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inquiry status updated.");
      router.refresh();
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
