import Link from "next/link";

import { listMektekOutboundPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
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

function readPage(searchParams: Record<string, string | string[] | undefined>) {
  const value = searchParams.page;
  return Math.max(Number(Array.isArray(value) ? value[0] : value) || 1, 1);
}

export default async function MektekLogisticsPage({
  params,
  searchParams,
}: MektekLogisticsPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  if (!canManageMektekLogistics(session?.user)) {
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
  const [result, catalogItems, pics] = await Promise.all([
    listMektekOutboundPurchaseOrders({
      page: readPage(resolvedSearchParams),
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
  const pageHref = (page: number) => `/${locale}/mektek/logistics?page=${page}`;
  const purchaseOrders = result.data.items.map(
    ({ inputDate, dueDate, deliveryDate, createdAt, updatedAt, items, ...order }) => ({
      ...order,
      inputDate: inputDate.toISOString(),
      dueDate: dueDate.toISOString(),
      deliveryDate: deliveryDate?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      items: items.map(({ createdAt, updatedAt, receipts, ...item }) => ({
        ...item,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        receipts: receipts.map(({ receivedAt, createdAt, ...receipt }) => ({
          ...receipt,
          receivedAt: receivedAt.toISOString(),
          createdAt: createdAt.toISOString(),
        })),
      })),
    }),
  );
  return (
    <Container
      title="Monitoring PO"
      description="Kelola PO pengiriman MekTek ke User, stok keluar, dan Surat Jalan"
    >
      <div className="flex flex-col gap-6">
        <OutboundLogisticsManager
          pics={pics}
          purchaseOrders={purchaseOrders}
          catalogItems={catalogItems.map(({ catalogPartNumber, ...item }) => ({
            ...item,
            partNumber: item.partNumber || catalogPartNumber,
          }))}
          stats={result.data.stats}
          mode="overview"
          spreadsheetHref={`/${locale}/mektek/logistics/spreadsheet`}
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
