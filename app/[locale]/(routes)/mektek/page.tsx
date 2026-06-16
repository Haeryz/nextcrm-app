import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import {
  getMektekServiceOrders,
  getMektekTechnicians,
} from "@/actions/mektek/service-orders";
import { authOptions } from "@/lib/auth";
import { canAccessMektekStaffArea, canCreateMektekOrders } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExcelExportButton from "./_components/ExcelExportButton";
import MektekOrderList from "./_components/MektekOrderList";
import MektekPagination from "./_components/MektekPagination";
import NewServiceOrderForm from "./_components/NewServiceOrderForm";

interface MektekPageProps {
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

export default async function MektekPage({ params, searchParams }: MektekPageProps) {
  const { locale = "en" } = params ? await params : { locale: "en" };
  const session = await getServerSession(authOptions);
  const canAccess = canAccessMektekStaffArea(session?.user);
  const canCreate = canCreateMektekOrders(session?.user);

  if (!canAccess) {
    return (
      <Container title="MEKTEK" description="Service order tracking">
        <Card className="border">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have access to the MekTek staff workspace.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentPage = Math.max(
    Number(readSearchParam(resolvedSearchParams, "page")) || 1,
    1
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
  const techniciansResult = canCreate ? await getMektekTechnicians() : { data: [] };
  const technicians = techniciansResult.data ?? [];

  return (
    <Container
      title="MEKTEK"
      description="Service order tracking - manage and monitor all repair jobs"
    >
      <div className="space-y-6">
        {canCreate ? (
          <NewServiceOrderForm technicians={technicians} />
        ) : (
          <Card className="border">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Only MekTek admin or CS can add new service records.
            </CardContent>
          </Card>
        )}

        <div className="flex justify-stretch sm:justify-end">
          <div className="w-full sm:w-auto">
            <ExcelExportButton orders={orders} />
          </div>
        </div>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <form
                action={`/${locale}/mektek`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
              >
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    From date
                  </span>
                  <Input name="dateFrom" type="date" defaultValue={dateFrom} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    To date
                  </span>
                  <Input name="dateTo" type="date" defaultValue={dateTo} />
                </label>
                <Button type="submit" variant="outline" className="w-full sm:w-auto">
                  Filter
                </Button>
                {(dateFrom || dateTo) && (
                  <Button asChild type="button" variant="ghost" className="w-full sm:w-auto">
                    <Link href={`/${locale}/mektek`}>Clear</Link>
                  </Button>
                )}
              </form>
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} - {totalCount} orders
              </p>
            </div>
          </CardContent>
        </Card>

        <MektekOrderList
          orders={orders}
          emptyMessage="No service records found for this date range."
          locale={locale}
        />

        <MektekPagination
          basePath={`/${locale}/mektek`}
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
