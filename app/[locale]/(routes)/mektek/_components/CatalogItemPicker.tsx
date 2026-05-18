"use client";

import { useState, useTransition } from "react";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

import { searchMektekCatalogItems } from "@/actions/mektek/service-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DamageItem } from "./DamageItemsInput";

type CatalogSearchItem = {
  id: string;
  machine: string;
  rowNumber: number;
  description: string;
  partNumber: string | null;
  catalogPartNumber: string | null;
  price: number | null;
};

type CatalogItemPickerProps = {
  disabled?: boolean;
  onAddItem: (item: DamageItem) => void;
};

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "No price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default function CatalogItemPicker({
  disabled,
  onAddItem,
}: CatalogItemPickerProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogSearchItem[]>([]);
  const [isPending, startTransition] = useTransition();

  const searchCatalog = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      toast.error("Type at least 2 characters to search catalog.");
      return;
    }

    startTransition(async () => {
      const result = await searchMektekCatalogItems(trimmed);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setItems(result.data ?? []);
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    searchCatalog();
  };

  const addCatalogItem = (item: CatalogSearchItem) => {
    onAddItem({
      catalogItemId: item.id,
      machine: item.machine,
      partNumber: item.partNumber ?? "",
      catalogPartNumber: item.catalogPartNumber ?? "",
      description: item.description,
      quantity: 1,
      estimatedCost: typeof item.price === "number" ? String(item.price) : "",
    });
    toast.success("Catalog item added as sparepart.");
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Catalog Items
        </p>
        <p className="text-sm text-muted-foreground">
          Search parts by machine, part number, or description, then add them to this order.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search catalog item..."
          disabled={disabled || isPending}
        />
        <Button
          type="button"
          variant="outline"
          onClick={searchCatalog}
          disabled={disabled || isPending}
        >
          <Search className="h-4 w-4" />
          {isPending ? "Searching..." : "Search"}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="max-h-80 overflow-y-auto rounded-md border bg-background">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.machine} · {item.catalogPartNumber || item.partNumber || "No part number"} · Row {item.rowNumber}
                </p>
                <p className="text-xs font-medium text-foreground">
                  {formatPrice(item.price)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => addCatalogItem(item)}
                disabled={disabled}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
