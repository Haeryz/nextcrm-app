import Link from "next/link";
import { Download } from "lucide-react";

import { listMektekReceivingPurchaseOrders } from "@/actions/mektek/logistics";
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
import ReceivingManager from "./_components/ReceivingManager";

interface MektekLogisticsPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readPageParam(searchParams: Record<string, string | string[] | undefined>) {
  const value = searchParams.page;
  const page = Array.isArray(value) ? value[0] : value;
  return Math.max(Number(page) || 1, 1);
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}

export default async function MektekReceivingPage({
  params,
  searchParams,
}: MektekLogisticsPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekLogistics(session?.user, "RECEIVING")) {
    return (
      <Container
        title="Receiving"
        description="Purchase Order MekTek ke supplier dan penerimaan barang"
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses untuk mengelola Receiving.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const initialPurchaseOrderId = readSearchParam(
    resolvedSearchParams,
    "detail",
  );
  const rawStatus = readSearchParam(resolvedSearchParams, "status").toUpperCase();
  const status = rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : "";
  const [result, pics, catalogItems] = await Promise.all([
    listMektekReceivingPurchaseOrders({
      query,
      status,
      page: readPageParam(resolvedSearchParams),
      pageSize: 20,
    }),
    prismadb.logisticsPic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prismadb.catalogItem.findMany({
      orderBy: [{ description: "asc" }, { partNumber: "asc" }],
      select: {
        id: true,
        description: true,
        partNumber: true,
        catalogPartNumber: true,
        price: true,
        rearStock: true,
        frontStock: true,
      },
    }),
  ]);

  if ("error" in result) {
    return (
      <Container
        title="Receiving"
        description="Purchase Order MekTek ke supplier dan penerimaan barang"
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
  const exportQuery = queryString.toString();
  const exportHref = `/api/mektek/receiving/purchase-orders/export${
    exportQuery ? `?${exportQuery}` : ""
  }`;
  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/receiving?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Receiving"
      description="Kelola PO ke supplier dan catat barang masuk ke Catalog / Item"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button asChild type="button">
            <Link
              href={exportHref}
              title="Export seluruh Purchase Order sesuai filter aktif"
            >
              <Download data-icon="inline-start" />
              Export Excel
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/receiving`}
              className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto_auto]"
            >
              <Input
                name="q"
                type="search"
                placeholder="Cari PO, supplier, project, atau item..."
                defaultValue={query}
                aria-label="Cari data Receiving"
              />
              <Select name="status" defaultValue={status || "ALL"}>
                <SelectTrigger aria-label="Filter status Receiving">
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
                  <Link href={`/${locale}/mektek/receiving`}>Reset Filter</Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <ReceivingManager
          pics={pics}
          catalogItems={catalogItems.map(
            ({ catalogPartNumber, ...catalogItem }) => ({
              ...catalogItem,
              partNumber: catalogItem.partNumber || catalogPartNumber,
              price:
                catalogItem.price == null ? null : Number(catalogItem.price),
            }),
          )}
          purchaseOrders={items.map(
            ({
              deliveryNoteImageData,
              supplierInvoiceImageData,
              ...purchaseOrder
            }) => ({
            ...purchaseOrder,
            hasDeliveryNoteImage: Boolean(deliveryNoteImageData),
            deliveryNoteImageUpdatedAt:
              purchaseOrder.deliveryNoteImageUpdatedAt?.toISOString() ?? null,
            hasSupplierInvoiceImage: Boolean(supplierInvoiceImageData),
            supplierInvoiceImageUpdatedAt:
              purchaseOrder.supplierInvoiceImageUpdatedAt?.toISOString() ??
              null,
            inputDate: purchaseOrder.inputDate.toISOString(),
            dueDate: purchaseOrder.dueDate.toISOString(),
            createdAt: purchaseOrder.createdAt.toISOString(),
            updatedAt: purchaseOrder.updatedAt.toISOString(),
            items: purchaseOrder.items.map((item) => ({
              ...item,
              agreedUnitPrice: item.agreedUnitPrice?.toString() ?? null,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
              receipts: item.receipts.map((receipt) => ({
                ...receipt,
                receivedAt: receipt.receivedAt.toISOString(),
                createdAt: receipt.createdAt.toISOString(),
              })),
            })),
            }),
          )}
          stats={stats}
          mode="combined"
          initialPurchaseOrderId={initialPurchaseOrderId || undefined}
          managePicsHref={
            session?.user?.isAdmin
              ? `/${locale}/mektek/receiving/pics`
              : undefined
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {result.data.page} of {totalPages} · {totalCount} Purchase Order
          </p>
          <nav
            aria-label="Halaman riwayat Purchase Order"
            className="flex flex-wrap items-center gap-2"
          >
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
