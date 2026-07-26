import Link from "next/link";

import { listMektekOutboundPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import {
  LiveFilterSelect,
  LiveSearchInput,
} from "@/app/[locale]/(routes)/mektek/_components/live-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getPaginationItems } from "@/lib/pagination";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import OutboundLogisticsManager from "./_components/OutboundLogisticsManager";

interface MektekLogisticsPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

export default async function MektekLogisticsPage({
  params,
  searchParams,
}: MektekLogisticsPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  if (!canManageMektekLogistics(session?.user, "MONITORING_PO")) {
    return (
      <Container
        title="Monitoring PO"
        description="Pengiriman item MekTek kepada User"
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
  const query = param(resolvedSearchParams, "q");
  const rawStatus = param(resolvedSearchParams, "status").toUpperCase();
  const status = rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : "";
  const page = Math.max(Number(param(resolvedSearchParams, "page")) || 1, 1);
  const [result, catalogItems, pics] = await Promise.all([
    listMektekOutboundPurchaseOrders({
      query,
      status,
      page,
      pageSize: 10,
    }),
    prismadb.catalogItem.findMany({
      orderBy: [{ description: "asc" }, { partNumber: "asc" }],
      select: {
        id: true,
        description: true,
        partNumber: true,
        catalogPartNumber: true,
        rearStock: true,
        frontStock: true,
      },
    }),
    prismadb.logisticsPic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if ("error" in result) {
    return (
      <Container title="Monitoring PO" description="Pengiriman item MekTek kepada User">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {result.error}
          </CardContent>
        </Card>
      </Container>
    );
  }

  const paginationItems = getPaginationItems(result.data.page, result.data.totalPages);
  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (status) baseParams.set("status", status);
  const pageHref = (targetPage: number) => {
    const next = new URLSearchParams(baseParams);
    next.set("page", String(targetPage));
    return `/${locale}/mektek/logistics?${next.toString()}`;
  };
  const purchaseOrders = result.data.items.map(
    ({
      deliveryNoteImageData: _deliveryNoteImageData,
      supplierInvoiceImageData: _supplierInvoiceImageData,
      mektekDeliveryNoteImageData: _mektekDeliveryNoteImageData,
      customerPoImageData,
      inputDate,
      dueDate,
      deliveryDate,
      createdAt,
      updatedAt,
      items,
      ...order
    }) => ({
      ...order,
      hasCustomerPoImage: Boolean(customerPoImageData),
      inputDate: inputDate.toISOString(),
      dueDate: dueDate.toISOString(),
      deliveryDate: deliveryDate?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      items: items.map(
        ({
          createdAt,
          updatedAt,
          receipts,
          agreedUnitPrice: _agreedUnitPrice,
          ...item
        }) => ({
          ...item,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          receipts: receipts.map(({ receivedAt, createdAt, ...receipt }) => ({
            ...receipt,
            receivedAt: receivedAt.toISOString(),
            createdAt: createdAt.toISOString(),
          })),
        }),
      ),
    }),
  );
  const logisticsBase = `/${locale}/mektek/logistics`;
  const currentQuery = baseParams.toString();

  return (
    <Container
      title="Monitoring PO"
      description="Kelola PO pengiriman MekTek ke User, stok keluar, dan Surat Jalan"
    >
      <div className="flex flex-col gap-6">
        <Card className="sticky top-0 z-30">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
              <LiveSearchInput
                basePath={logisticsBase}
                currentQuery={currentQuery}
                paramName="q"
                defaultValue={query}
                placeholder="Cari PO, Surat Jalan, User, project, atau item"
                ariaLabel="Cari Monitoring PO"
              />
              <LiveFilterSelect
                basePath={logisticsBase}
                currentQuery={currentQuery}
                paramName="status"
                defaultValue={status}
                ariaLabel="Filter status Monitoring PO"
                options={[
                  { value: "ALL", label: "Semua status" },
                  { value: "OPEN", label: "Open" },
                  { value: "CLOSED", label: "Closed" },
                ]}
              />
              {(query || status) && (
                <Button asChild type="button" variant="ghost">
                  <Link href={logisticsBase}>Reset Filter</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <OutboundLogisticsManager
          pics={pics}
          purchaseOrders={purchaseOrders}
          catalogItems={catalogItems.map(({ catalogPartNumber, ...item }) => ({
            ...item,
            partNumber: item.partNumber || catalogPartNumber,
          }))}
          stats={result.data.stats}
          mode="overview"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {result.data.page} of {result.data.totalPages} · {result.data.totalCount} PO
          </p>
          <nav aria-label="Halaman Monitoring PO" className="flex flex-wrap gap-2">
            <Button
              asChild={result.data.page > 1}
              variant="outline"
              size="sm"
              disabled={result.data.page <= 1}
            >
              {result.data.page > 1 ? (
                <Link href={pageHref(result.data.page - 1)}>Sebelumnya</Link>
              ) : (
                <span>Sebelumnya</span>
              )}
            </Button>
            {paginationItems.map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={item}
                  asChild
                  size="icon"
                  variant={item === result.data.page ? "default" : "outline"}
                >
                  <Link href={pageHref(item)}>{item}</Link>
                </Button>
              ),
            )}
            <Button
              asChild={result.data.page < result.data.totalPages}
              variant="outline"
              size="sm"
              disabled={result.data.page >= result.data.totalPages}
            >
              {result.data.page < result.data.totalPages ? (
                <Link href={pageHref(result.data.page + 1)}>Berikutnya</Link>
              ) : (
                <span>Berikutnya</span>
              )}
            </Button>
          </nav>
        </div>
      </div>
    </Container>
  );
}
