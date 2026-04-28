"use client";

import { useState, useTransition } from "react";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitCatalogInquiry } from "@/actions/catalog/customer";
import type { InquiryListItem } from "./useInquiryList";

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Ask for price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default function InquiryPanel({
  items,
  itemCount,
  updateQuantity,
  removeItem,
  clearItems,
}: {
  items: InquiryListItem[];
  itemCount: number;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearItems: () => void;
}) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitInquiry() {
    startTransition(async () => {
      const result = await submitCatalogInquiry({
        items: items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
        note,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      clearItems();
      setNote("");
      toast.success("Inquiry submitted. Admin will follow up.");
    });
  }

  return (
    <Card className="sticky top-5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Inquiry list</CardTitle>
            <CardDescription>Parts you want admin to quote or confirm.</CardDescription>
          </div>
          <Badge variant="secondary">{itemCount}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Add catalogue items to start an inquiry.
          </div>
        ) : (
          <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.itemId} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.machine} · {item.catalogPartNumber || item.partNumber || "No part number"}
                    </p>
                    <p className="mt-1 text-xs font-medium">{formatPrice(item.price)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.itemId)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Qty</span>
                  <Input
                    className="h-8 w-20"
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(event) =>
                      updateQuantity(item.itemId, Number(event.target.value))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note for admin"
          disabled={isPending}
        />
        <Button
          type="button"
          onClick={submitInquiry}
          disabled={items.length === 0 || isPending}
        >
          <Send className="size-4" />
          {isPending ? "Submitting..." : "Submit inquiry"}
        </Button>
      </CardContent>
    </Card>
  );
}
