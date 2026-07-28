import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import { getMektekServiceOrders } from "@/actions/mektek/service-orders";
import { authOptions } from "@/lib/auth";
import { canViewMektekOrders } from "@/lib/mektek/permissions";
import { getMektekServiceOrderExportMonthKey } from "@/lib/mektek/service-order-export";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExcelExportButton from "../_components/ExcelExportButton";
import MektekOrderList from "../_components/MektekOrderList";
import MektekPagination from "../_components/MektekPagination";

interface MektekHistoryPageProps {
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

export default async function MektekHistoryPage({
  params,
  searchParams,
}: MektekHistoryPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  const canAccess = canViewMektekOrders(session?.user);

  if (!canAccess) {
    return (
      <Container
        title="History"
        description="Riwayat seluruh pesanan servis MekTek"
      >
        <Card className="border">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses ke ruang kerja staf MekTek.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentPage = Math.max(
    Number(readSearchParam(resolvedSearchParams, "page")) || 1,
    1,
  );
  const dateFrom = readSearchParam(resolvedSearchParams, "dateFrom");
  const dateTo = readSearchParam(resolvedSearchParams, "dateTo");
  const { orders, page, pageSize, totalCount, totalPages } =
    await getMektekServiceOrders({
      page: currentPage,
      pageSize: 8,
      dateFrom,
      dateTo,
    });

  return (
    <Container
      title="History"
      description="Riwayat seluruh pesanan servis MekTek"
    >
      <div className="space-y-6">
        <div className="flex justify-stretch sm:justify-end">
          <div className="w-full sm:w-auto">
            <ExcelExportButton
              initialMonth={getMektekServiceOrderExportMonthKey()}
            />
          </div>
        </div>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <form
                action={`/${locale}/mektek/history`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
              >
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tanggal mulai
                  </span>
                  <Input name="dateFrom" type="date" defaultValue={dateFrom} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tanggal akhir
                  </span>
                  <Input name="dateTo" type="date" defaultValue={dateTo} />
                </label>
                <Button type="submit" variant="outline" className="w-full sm:w-auto">
                  Filter
                </Button>
                {(dateFrom || dateTo) && (
                  <Button
                    asChild
                    type="button"
                    variant="ghost"
                    className="w-full sm:w-auto"
                  >
                    <Link href={`/${locale}/mektek/history`}>Reset Filter</Link>
                  </Button>
                )}
              </form>
              <p className="text-sm text-muted-foreground">
                Halaman {page} dari {totalPages} - {totalCount} pesanan
              </p>
            </div>
          </CardContent>
        </Card>

        <MektekOrderList
          orders={orders}
          emptyMessage="Tidak ada catatan servis dalam rentang tanggal ini."
          locale={locale}
        />

        <MektekPagination
          basePath={`/${locale}/mektek/history`}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          query={{ dateFrom, dateTo }}
        />
      </div>
    </Container>
  );
}
