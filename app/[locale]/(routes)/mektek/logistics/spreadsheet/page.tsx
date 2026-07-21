import Link from "next/link";

import { listMektekLogisticsPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getPaginationItems } from "@/lib/pagination";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import LogisticsManager from "../_components/LogisticsManager";

interface MektekLogisticsSpreadsheetPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MektekLogisticsSpreadsheetPage({
  params,
  searchParams,
}: MektekLogisticsSpreadsheetPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekLogistics(session?.user)) {
    return (
      <Container
        title="Spreadsheet PO Logistics"
        description="Tracking Purchase Order dan barang masuk dari supplier"
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses untuk mengelola Logistics.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const rawStatus = readSearchParam(resolvedSearchParams, "status").toUpperCase();
  const status = rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : "";
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const [result, pics] = await Promise.all([
    listMektekLogisticsPurchaseOrders({
      query,
      status,
      page,
      pageSize: 20,
    }),
    prismadb.logisticsPic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if ("error" in result) {
    return (
      <Container
        title="Spreadsheet PO Logistics"
        description="Tracking Purchase Order dan barang masuk dari supplier"
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {result.error}
          </CardContent>
        </Card>
      </Container>
    );
  }

  const { items, stats, totalCount, totalPages } = result.data;
  const paginationItems = getPaginationItems(result.data.page, totalPages);
  const queryString = new URLSearchParams();
  if (query) queryString.set("q", query);
  if (status) queryString.set("status", status);

  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/logistics/spreadsheet?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Spreadsheet PO Logistics"
      description="Pantau PO supplier, penerimaan parsial, dan quantity yang masih pending"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-start">
          <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
            <Link href={`/${locale}/mektek/logistics`}>Kembali ke Logistics</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/logistics/spreadsheet`}
              className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto_auto]"
            >
              <Input
                name="q"
                type="search"
                placeholder="Cari PO, supplier, User/PT, project, part, surat jalan..."
                defaultValue={query}
                aria-label="Cari data Logistics"
              />
              <Select name="status" defaultValue={status || "ALL"}>
                <SelectTrigger aria-label="Filter status Logistics">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline">
                Filter
              </Button>
              {(query || status) && (
                <Button asChild type="button" variant="ghost">
                  <Link href={`/${locale}/mektek/logistics/spreadsheet`}>Reset Filter</Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <LogisticsManager
          pics={pics}
          purchaseOrders={items.map((purchaseOrder) => ({
            ...purchaseOrder,
            inputDate: purchaseOrder.inputDate.toISOString(),
            dueDate: purchaseOrder.dueDate.toISOString(),
            createdAt: purchaseOrder.createdAt.toISOString(),
            updatedAt: purchaseOrder.updatedAt.toISOString(),
            items: purchaseOrder.items.map((item) => ({
              ...item,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
              receipts: item.receipts.map((receipt) => ({
                ...receipt,
                receivedAt: receipt.receivedAt.toISOString(),
                createdAt: receipt.createdAt.toISOString(),
              })),
            })),
          }))}
          stats={stats}
          mode="spreadsheet"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {result.data.page} of {totalPages} · {totalCount} Purchase Order
          </p>
          <nav aria-label="Halaman Logistics" className="flex flex-wrap items-center gap-2">
            {result.data.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(result.data.page - 1)}>Sebelumnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Sebelumnya
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
                  variant={item === result.data.page ? "default" : "outline"}
                  size="icon"
                  aria-current={item === result.data.page ? "page" : undefined}
                  aria-label={`Halaman ${item}`}
                >
                  <Link href={pageHref(item)}>{item}</Link>
                </Button>
              ),
            )}
            {result.data.page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(result.data.page + 1)}>Berikutnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Berikutnya
              </Button>
            )}
          </nav>
        </div>
      </div>
    </Container>
  );
}
