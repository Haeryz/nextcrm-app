import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";

import { listMektekCatalogItems } from "@/actions/mektek/catalog-items";
import { authOptions } from "@/lib/auth";
import { canCreateMektekOrders } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const { locale = "en" } = params ? await params : { locale: "en" };
  const session = await getServerSession(authOptions);

  if (!canCreateMektekOrders(session?.user)) {
    return (
      <Container title="Catalogue Items" description="MekTek item management">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only MekTek admin or CS can manage catalogue items.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const machine = readSearchParam(resolvedSearchParams, "machine");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const catalog = await listMektekCatalogItems({
    query,
    machine,
    page,
    pageSize: 18,
  });

  const previousPage = Math.max(1, catalog.page - 1);
  const nextPage = Math.min(catalog.totalPages, catalog.page + 1);
  const queryString = new URLSearchParams();
  if (query) queryString.set("q", query);
  if (machine) queryString.set("machine", machine);

  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/items?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Catalogue Items"
      description="Create, update, delete, and review items extracted from the parts catalogue"
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/items`}
              className="grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]"
            >
              <Input name="q" placeholder="Search description, machine, or part number" defaultValue={query} />
              <Input name="machine" placeholder="Machine" defaultValue={machine} />
              <Button type="submit" variant="outline">
                Filter
              </Button>
              {(query || machine) && (
                <Button asChild type="button" variant="ghost">
                  <Link href={`/${locale}/mektek/items`}>Clear</Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <CatalogItemManager items={catalog.items} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {catalog.page} of {catalog.totalPages} - {catalog.totalCount} items
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={catalog.page <= 1}>
              <Link href={pageHref(previousPage)}>Previous</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={catalog.page >= catalog.totalPages}
            >
              <Link href={pageHref(nextPage)}>Next</Link>
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
