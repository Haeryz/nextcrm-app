"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackagePlus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogItem } from "@/lib/catalog/types";
import { useInquiryList } from "./useInquiryList";

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Ask for price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

function ProductImage({ item }: { item: CatalogItem }) {
  if (!item.imageUrl) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        No image
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={item.description}
      className="aspect-[4/3] w-full rounded-md object-contain bg-muted"
      loading="lazy"
    />
  );
}

export default function CustomerCatalogClient({
  items,
  machines,
}: {
  items: CatalogItem[];
  machines: string[];
}) {
  const [query, setQuery] = useState("");
  const [machine, setMachine] = useState("all");
  const inquiry = useInquiryList();

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesMachine = machine === "all" || item.machine === machine;
      const matchesQuery =
        !normalizedQuery || item.searchText.includes(normalizedQuery);
      return matchesMachine && matchesQuery;
    });
  }, [items, machine, query]);

  function addToInquiry(item: CatalogItem) {
    inquiry.addItem(item, 1);
    toast.success("Added to inquiry list.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search description or part number"
              className="pl-9"
            />
          </div>
          <Select value={machine} onValueChange={setMachine}>
            <SelectTrigger>
              <SelectValue placeholder="Machine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All machines</SelectItem>
              {machines.map((machineName) => (
                <SelectItem key={machineName} value={machineName}>
                  {machineName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => (
          <Card key={item.id} className="flex flex-col overflow-hidden">
            <CardHeader className="gap-3">
              <Link href={`/customer/catalog/${item.id}`}>
                <ProductImage item={item} />
              </Link>
              <div className="flex flex-col gap-1">
                <CardTitle className="line-clamp-2 text-base">
                  <Link href={`/customer/catalog/${item.id}`}>
                    {item.description || "Catalogue item"}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {item.machine} · {item.catalogPartNumber || item.partNumber || "No part number"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant={item.price ? "default" : "secondary"}>
                  {formatPrice(item.price)}
                </Badge>
                {item.quantity !== null && (
                  <span className="text-xs text-muted-foreground">
                    Qty {String(item.quantity)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline">
                  <Link href={`/customer/catalog/${item.id}`}>Details</Link>
                </Button>
                <Button type="button" onClick={() => addToInquiry(item)}>
                  <PackagePlus className="size-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
