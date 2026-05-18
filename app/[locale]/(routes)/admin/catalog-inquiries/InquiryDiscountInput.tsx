"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Percent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCatalogInquiryDiscount } from "@/actions/catalog/admin";

export default function InquiryDiscountInput({
  inquiryId,
  discountPercent,
}: {
  inquiryId: string;
  discountPercent: number;
}) {
  const [value, setValue] = useState(String(discountPercent));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function saveDiscount() {
    startTransition(async () => {
      const result = await updateCatalogInquiryDiscount({
        inquiryId,
        discountPercent: value,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Inquiry discount updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`discount-${inquiryId}`}>
        Discount percentage
      </label>
      <div className="relative">
        <Percent className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`discount-${inquiryId}`}
          aria-label="Discount percentage"
          className="w-28 pl-8"
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
        />
      </div>
      <Button type="button" variant="outline" onClick={saveDiscount} disabled={isPending}>
        Save
      </Button>
    </div>
  );
}
