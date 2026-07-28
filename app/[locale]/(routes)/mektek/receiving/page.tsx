import Link from "next/link";
import { Download } from "lucide-react";

import { listMektekReceivingPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import {
  LiveFilterSelect,
  LiveSearchInput,
} from "@/app/[locale]/(routes)/mektek/_components/live-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics, canManageMektekLogisticsPics } from "@/lib/mektek/permissions";
import { getPaginationItems } from "@/lib/pagination";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { getSupplierNameSuggestions } from "@/lib/mektek/supplier-names";
import ReceivingManager from "./_components/ReceivingManager";
import ReceivingExportButton from "./_components/ReceivingExportButton";

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
  const [result, pics, catalogItems, supplierNameSuggestions] = await Promise.all([
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
    getSupplierNameSuggestions(),
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
  const exportBaseQuery = exportQuery;
  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/receiving?${paramsForPage.toString()}`;
  };

  const receivingBase = `/${locale}/mektek/receiving`;
  const currentQuery = queryString.toString();

  return (
    <Container
      title="Receiving"
      description="Kelola PO ke supplier dan catat barang masuk ke Catalog / Item"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
          <Button asChild type="button">
            <Link
              href={exportHref}
              title="Export seluruh Purchase Order sesuai filter aktif"
            >
              <Download data-icon="inline-start" />
              Export Excel
            </Link>
          </Button>
          <ReceivingExportButton baseQuery={exportBaseQuery} />
        </div>

        <Card className="md:sticky md:top-0 md:z-30">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
              <LiveSearchInput
                basePath={receivingBase}
                currentQuery={currentQuery}
                paramName="q"
                defaultValue={query}
                placeholder="Cari PO, supplier, project, atau item..."
                ariaLabel="Cari data Receiving"
              />
              <LiveFilterSelect
                basePath={receivingBase}
                currentQuery={currentQuery}
                paramName="status"
                defaultValue={status}
                ariaLabel="Filter status Receiving"
                options={[
                  { value: "ALL", label: "Semua status" },
                  { value: "OPEN", label: "Open" },
                  { value: "CLOSED", label: "Closed" },
                ]}
              />
              {(query || status) && (
                <Button asChild type="button" variant="ghost">
                  <Link href={receivingBase}>Reset Filter</Link>
                </Button>
              )}
            </div>
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
              mektekDeliveryNoteImageData,
              signedPoImageData,
              ...purchaseOrder
            }) => ({
            ...purchaseOrder,
            hasDeliveryNoteImage: Boolean(deliveryNoteImageData),
            deliveryNoteImageUpdatedAt:
              purchaseOrder.deliveryNoteImageUpdatedAt?.toISOString() ?? null,
            hasMektekDeliveryNoteImage: Boolean(mektekDeliveryNoteImageData),
            mektekDeliveryNoteImageUpdatedAt:
              purchaseOrder.mektekDeliveryNoteImageUpdatedAt?.toISOString() ??
              null,
            hasSupplierInvoiceImage: Boolean(supplierInvoiceImageData),
            supplierInvoiceImageUpdatedAt:
              purchaseOrder.supplierInvoiceImageUpdatedAt?.toISOString() ??
              null,
            hasSignedPoImage: Boolean(signedPoImageData),
            signedPoImageUpdatedAt:
              purchaseOrder.signedPoImageUpdatedAt?.toISOString() ?? null,
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
          supplierNameSuggestions={supplierNameSuggestions}
          initialPurchaseOrderId={initialPurchaseOrderId || undefined}
          managePicsHref={
            canManageMektekLogisticsPics(session?.user)
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
