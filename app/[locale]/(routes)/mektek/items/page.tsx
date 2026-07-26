import Container from "@/app/[locale]/(routes)/components/ui/Container";
import {
  LiveFilterSelect,
  LiveSearchInput,
} from "@/app/[locale]/(routes)/mektek/_components/live-filters";
import Link from "next/link";

import { listMektekCatalogInventoryItems } from "@/actions/mektek/catalog-inventory";
import { authOptions } from "@/lib/auth";
import { canManageMektekCatalog } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getExistingCatalogImagePath } from "@/lib/catalog-images";
import { getPaginationItems } from "@/lib/pagination";
import CatalogItemManager from "./_components/CatalogItemManager";

interface MektekCatalogItemsPageProps {
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

export default async function MektekCatalogItemsPage({
  params,
  searchParams,
}: MektekCatalogItemsPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekCatalog(session?.user)) {
    return (
      <Container title="Catalogue Items" description="Kelola item MekTek">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Hanya Admin atau CS MekTek yang dapat mengelola Catalogue Items.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const machine = readSearchParam(resolvedSearchParams, "machine");
  const rawProductionChannel = readSearchParam(resolvedSearchParams, "channel");
  const productionChannel =
    rawProductionChannel === "POWERTRAIN" || rawProductionChannel === "THERMAL"
      ? rawProductionChannel
      : "";
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const catalog = await listMektekCatalogInventoryItems({
    query,
    machine,
    productionChannel,
    page,
    pageSize: 18,
  });

  const previousPage = Math.max(1, catalog.page - 1);
  const nextPage = Math.min(catalog.totalPages, catalog.page + 1);
  const paginationItems = getPaginationItems(catalog.page, catalog.totalPages);
  const queryString = new URLSearchParams();
  if (query) queryString.set("q", query);
  if (machine) queryString.set("machine", machine);
  if (productionChannel) queryString.set("channel", productionChannel);
  const itemsBase = `/${locale}/mektek/items`;
  const currentQuery = queryString.toString();

  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `${itemsBase}?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Catalog / Item"
      description="Master sparepart terintegrasi dengan Monitoring PO, Receiving, dan inventory"
    >
      <div className="flex flex-col gap-6">
        <Card className="sticky top-0 z-30">
          <CardContent className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)_190px_auto]">
              <LiveSearchInput
                basePath={itemsBase}
                currentQuery={currentQuery}
                paramName="q"
                defaultValue={query}
                placeholder="Cari Item Name, Machine, Part Number, atau lokasi"
                ariaLabel="Cari Catalog Item"
              />
              <LiveSearchInput
                basePath={itemsBase}
                currentQuery={currentQuery}
                paramName="machine"
                defaultValue={machine}
                placeholder="Machine"
                ariaLabel="Filter Machine"
              />
              <LiveFilterSelect
                basePath={itemsBase}
                currentQuery={currentQuery}
                paramName="channel"
                defaultValue={productionChannel}
                ariaLabel="Filter Production Channel"
                options={[
                  { value: "ALL", label: "Semua channel" },
                  { value: "POWERTRAIN", label: "Powertrain" },
                  { value: "THERMAL", label: "Thermal" },
                ]}
              />
              {(query || machine || productionChannel) && (
                <Button asChild type="button" variant="ghost" className="w-full lg:w-auto">
                  <Link href={itemsBase}>Reset Filter</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <CatalogItemManager
          spreadsheetHref={`/${locale}/mektek/items/spreadsheet`}
          items={catalog.items.map((item) => ({
            ...item,
            imagePath: getExistingCatalogImagePath(item.imagePath),
          }))}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {catalog.page} of {catalog.totalPages} - {catalog.totalCount} items
          </p>
          <nav
            aria-label="Halaman Catalogue Items"
            className="flex flex-wrap items-center gap-2"
          >
            {catalog.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(previousPage)}>Sebelumnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}

            {paginationItems.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  asChild
                  variant={item === catalog.page ? "default" : "outline"}
                  size="icon"
                  aria-current={item === catalog.page ? "page" : undefined}
                  aria-label={`Halaman ${item}`}
                >
                  <Link href={pageHref(item)}>{item}</Link>
                </Button>
              ),
            )}

            {catalog.page < catalog.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(nextPage)}>Berikutnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </nav>
        </div>
      </div>
    </Container>
  );
}
