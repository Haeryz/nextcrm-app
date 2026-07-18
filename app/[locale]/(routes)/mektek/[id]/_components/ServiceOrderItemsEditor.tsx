"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { appendMektekServiceOrderItems } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import DamageItemsInput, {
  type DamageItem,
} from "../../_components/DamageItemsInput";

interface ServiceOrderItemsEditorProps {
  serviceOrderId: string;
}

const blankItem = (): DamageItem => ({
  description: "",
  estimatedCost: "",
  quantity: 1,
});

export default function ServiceOrderItemsEditor({
  serviceOrderId,
}: ServiceOrderItemsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serviceItems, setServiceItems] = useState<DamageItem[]>([blankItem()]);
  const [sparepartItems, setSparepartItems] = useState<DamageItem[]>([]);

  const submit = () => {
    const validServiceItems = serviceItems.filter((item) => item.description.trim());
    const validSparepartItems = sparepartItems.filter((item) => item.description.trim());
    if (validServiceItems.length === 0 && validSparepartItems.length === 0) {
      toast.error("Add at least one service or sparepart item");
      return;
    }

    startTransition(async () => {
      const result = await appendMektekServiceOrderItems({
        serviceOrderId,
        serviceItems: validServiceItems,
        sparepartItems: validSparepartItems,
      });
      if (!result || "error" in result) {
        toast.error(result?.error || "Failed to add order items");
        return;
      }

      setServiceItems([blankItem()]);
      setSparepartItems([]);
      toast.success("Order items and payment total updated");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Separator />
      <div>
        <p className="text-sm font-semibold">Add service or sparepart</p>
        <p className="mt-1 text-xs text-muted-foreground">
          New prices are added to the invoice and final payment total immediately.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DamageItemsInput
          items={serviceItems}
          onChange={setServiceItems}
          label="Additional Service Description"
          addLabel="Add service description"
          emptyMessage="No additional service description yet."
          descriptionPlaceholder={(index) => `Service description ${index + 1}`}
          disabled={isPending}
        />
        <DamageItemsInput
          items={sparepartItems}
          onChange={setSparepartItems}
          label="Additional Sparepart Items"
          addLabel="Add sparepart"
          emptyMessage="No additional sparepart yet."
          descriptionPlaceholder={(index) => `Sparepart ${index + 1}`}
          disabled={isPending}
          catalogSearch
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          Add to order
        </Button>
      </div>
    </div>
  );
}
