import Link from "next/link";

import { listMektekReceivingPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function MektekReceivingPage({
  params,
  searchParams,
}: MektekLogisticsPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekLogistics(session?.user)) {
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
  const [result, pics, catalogItems] = await Promise.all([
    listMektekReceivingPurchaseOrders({
      page: readPageParam(resolvedSearchParams),
      pageSize: 10,
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
  const pageHref = (targetPage: number) => `/${locale}/mektek/receiving?page=${targetPage}`;

  return (
    <Container
      title="Receiving"
      description="Kelola PO ke supplier dan catat barang masuk ke Catalog / Item"
    >
      <div className="flex flex-col gap-6">
        <ReceivingManager
          pics={pics}
          catalogItems={catalogItems.map(
            ({ catalogPartNumber, ...catalogItem }) => ({
              ...catalogItem,
              partNumber: catalogItem.partNumber || catalogPartNumber,
            }),
          )}
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
          spreadsheetHref={`/${locale}/mektek/receiving/spreadsheet`}
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
