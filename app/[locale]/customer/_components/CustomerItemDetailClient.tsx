"use client";

import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CatalogItem } from "@/lib/catalog/types";
import { useInquiryList } from "./useInquiryList";
import InquiryPanel from "./InquiryPanel";

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Ask for price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function DetailImage({ item }: { item: CatalogItem }) {
  if (!item.imageUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
        No product image
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={item.description}
      className="aspect-[4/3] w-full rounded-md object-contain bg-muted"
    />
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium">{value || "-"}</div>
    </div>
  );
}

export default function CustomerItemDetailClient({
  item,
  relatedItems,
}: {
  item: CatalogItem;
  relatedItems: CatalogItem[];
}) {
  const inquiry = useInquiryList();

  function addToInquiry(selected: CatalogItem) {
    inquiry.addItem(selected, 1);
    toast.success("Added to inquiry list.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/customer">
            <ArrowLeft className="size-4" />
            Back to catalogue
          </Link>
        </Button>
        <Badge variant="secondary">{item.machine}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,480px)_1fr]">
              <DetailImage item={item} />
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Part detail
                  </p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight">
                    {item.description || "Catalogue item"}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Review compatibility and part numbers before submitting an inquiry.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatPrice(item.price)}</Badge>
                  {item.quantity !== null && (
                    <Badge variant="secondary">Qty {String(item.quantity)}</Badge>
                  )}
                  {item.illustration && (
                    <Badge variant="outline">Illust. {item.illustration}</Badge>
                  )}
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Machine" value={item.machine} />
                  <DetailRow label="Workbook row" value={item.rowNumber} />
                  <DetailRow label="Original part" value={item.partNumber} />
                  <DetailRow label="Mektek/Esel part" value={item.catalogPartNumber} />
                </div>
                {item.remark && (
                  <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {item.remark}
                  </div>
                )}
                <Button type="button" className="h-11" onClick={() => addToInquiry(item)}>
                  <PackagePlus className="size-4" />
                  Add to inquiry
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Related items</CardTitle>
              <CardDescription>More parts listed for {item.machine}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {relatedItems.length === 0 ? (
                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                  No related items found.
                </div>
              ) : (
                relatedItems.map((related) => (
                  <Link key={related.id} href={`/customer/catalog/${related.id}`}>
                    <div className="h-full rounded-md border p-4 transition-colors hover:bg-muted/50">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {related.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {related.catalogPartNumber || related.partNumber || "No part number"}
                      </p>
                      <p className="mt-2 text-xs font-medium">
                        {formatPrice(related.price)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <InquiryPanel
          items={inquiry.items}
          itemCount={inquiry.itemCount}
          updateQuantity={inquiry.updateQuantity}
          removeItem={inquiry.removeItem}
          clearItems={inquiry.clearItems}
        />
      </div>
    </div>
  );
}
