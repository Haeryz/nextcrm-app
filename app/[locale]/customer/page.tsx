import Link from "next/link";
import { Search } from "lucide-react";

import { listMektekCatalogItems } from "@/actions/mektek/catalog-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface CustomerCatalogPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Hubungi admin";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default async function CustomerCatalogPage({
  params,
  searchParams,
}: CustomerCatalogPageProps) {
  const { locale = "en" } = params ? await params : { locale: "en" };
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const machine = readSearchParam(resolvedSearchParams, "machine");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const catalog = await listMektekCatalogItems({
    query,
    machine,
    page,
    pageSize: 24,
  });

  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (machine) baseParams.set("machine", machine);
  const pageHref = (targetPage: number) => {
    const nextParams = new URLSearchParams(baseParams);
    nextParams.set("page", String(targetPage));
    return `/${locale}/customer?${nextParams.toString()}`;
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              MekTek Catalogue
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Sparepart catalogue
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Browse available machine parts by model, part number, or description.
            </p>
          </div>

          <form
            action={`/${locale}/customer`}
            className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_220px_auto]"
          >
            <Input
              name="q"
              placeholder="Search part number, item name, or description"
              defaultValue={query}
            />
            <Input name="machine" placeholder="Machine" defaultValue={machine} />
            <Button type="submit">
              <Search data-icon="inline-start" />
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {catalog.totalCount} item{catalog.totalCount === 1 ? "" : "s"} found
          </p>
          {(query || machine) && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${locale}/customer`}>Clear filters</Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalog.items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-[4/3] bg-muted">
                {item.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imagePath}
                    alt={item.description}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <CardContent className="flex min-h-56 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{item.machine}</Badge>
                  <span className="text-xs text-muted-foreground">Row {item.rowNumber}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <h2 className="line-clamp-2 text-base font-semibold">
                    {item.description}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {item.catalogPartNumber || item.partNumber || "No part number"}
                  </p>
                  {item.remark && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.remark}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold">{formatPrice(item.price)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {catalog.items.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No catalogue items match this search.
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {catalog.page} of {catalog.totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={catalog.page <= 1}>
              <Link href={pageHref(Math.max(1, catalog.page - 1))}>Previous</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={catalog.page >= catalog.totalPages}
            >
              <Link href={pageHref(Math.min(catalog.totalPages, catalog.page + 1))}>
                Next
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
