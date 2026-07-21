import Link from "next/link";

import { listMektekLogisticsPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getPaginationItems } from "@/lib/pagination";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import LogisticsManager from "./_components/LogisticsManager";

interface MektekLogisticsPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readPageParam(searchParams: Record<string, string | string[] | undefined>) {
  const value = searchParams.page;
  const page = Array.isArray(value) ? value[0] : value;
  return Math.max(Number(page) || 1, 1);
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
        title="Logistics"
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
  const [result, pics] = await Promise.all([
    listMektekLogisticsPurchaseOrders({
      page: readPageParam(resolvedSearchParams),
      pageSize: 10,
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
        title="Logistics"
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
  const pageHref = (targetPage: number) => `/${locale}/mektek/logistics?page=${targetPage}`;

  return (
    <Container
      title="Logistics"
      description="Kelola Purchase Order dan lihat riwayat penerimaan barang supplier"
    >
      <div className="flex flex-col gap-6">
        {!!session?.user?.isAdmin && (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={`/${locale}/mektek/logistics/pics`}>Kelola PIC</Link>
            </Button>
          </div>
        )}
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
          mode="overview"
          spreadsheetHref={`/${locale}/mektek/logistics/spreadsheet`}
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
