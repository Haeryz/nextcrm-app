import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMektekServiceOrders,
} from "@/actions/mektek/service-orders";
import NewServiceOrderForm from "./_components/NewServiceOrderForm";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import { calculateProgress, getStatusMeta } from "./_lib/constants";
import MektekSubNav from "./_components/MektekSubNav";
import ExcelExportButton from "./_components/ExcelExportButton";

interface MektekPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildPageHref(params: {
  page: number;
  dateFrom: string;
  dateTo: string;
}) {
  const query = new URLSearchParams();
  if (params.page > 1) query.set("page", String(params.page));
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  const suffix = query.toString();
  return suffix ? `/mektek?${suffix}` : "/mektek";
}

export default async function MektekPage({ searchParams }: MektekPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.isAdmin;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentPage = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const dateFrom = readSearchParam(resolvedSearchParams, "dateFrom");
  const dateTo = readSearchParam(resolvedSearchParams, "dateTo");
  const { orders, page, totalCount, totalPages } = await getMektekServiceOrders({
    page: currentPage,
    pageSize: 10,
    dateFrom,
    dateTo,
  });
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((pageNumber) => {
      return (
        pageNumber === 1 ||
        pageNumber === totalPages ||
        Math.abs(pageNumber - page) <= 1
      );
    });

  return (
    <Container
      title="MEKTEK"
      description="Service order tracking — manage and monitor all repair jobs"
    >
      <div className="space-y-6">
        <MektekSubNav activeTab="orders" />

        {isAdmin ? (
          <NewServiceOrderForm />
        ) : (
          <Card className="border">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Only admin can add new service records.
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <ExcelExportButton orders={orders} />
        </div>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <form action="/mektek" className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
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
                <Button type="submit" variant="outline">
                  Filter
                </Button>
                {(dateFrom || dateTo) && (
                  <Button asChild type="button" variant="ghost">
                    <Link href="/mektek">Clear</Link>
                  </Button>
                )}
              </form>
              <p className="text-sm text-muted-foreground">
                Showing {orders.length} of {totalCount} orders
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {orders.length === 0 && (
            <Card className="border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No service records found for this date range.
              </CardContent>
            </Card>
          )}

          {orders.map((order) => {
            const tags =
              order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
                ? (order.tags as Record<string, unknown>)
                : {};

            const vehicle =
              typeof tags.vehicle === "string" && tags.vehicle.length > 0
                ? tags.vehicle
                : "Unknown vehicle";
            const customerName =
              typeof tags.customerName === "string" && tags.customerName.length > 0
                ? tags.customerName
                : order.crm_accounts?.name ?? "Unknown customer";

            const timelineItems: { completed: boolean }[] = Array.isArray(tags.timeline)
              ? (tags.timeline as Array<Record<string, unknown>>).map((item) => ({
                  completed: typeof item.completed === "boolean" ? item.completed : true,
                }))
              : [];
            const progress = calculateProgress(timelineItems, order.taskStatus);
            const statusMeta = getStatusMeta(order.taskStatus);
            const timelineCount = timelineItems.length || 1;

            return (
              <Link key={order.id} href={`/mektek/${order.id}`}>
            <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: customer info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">
                        ID: {order.id.slice(0, 8)}
                      </span>
                      <Badge variant={statusMeta.badgeVariant}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="font-bold text-lg text-foreground">
                      {customerName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Last updated: {order.updatedAt?.toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[11px] rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {timelineCount} timeline updates
                      </span>
                      <span className="text-[11px] rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        Vehicle Service
                      </span>
                    </div>
                  </div>

                  {/* Right: progress */}
                  <div className="flex flex-col items-end gap-2 shrink-0 w-40">
                    <span className="text-sm font-bold text-foreground">
                      {progress}%
                    </span>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${statusMeta.barColor} rounded-full transition-all`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Progress
                    </span>
                  </div>
                </div>

                {/* Order count + estimated done */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {timelineCount} order step{timelineCount === 1 ? "" : "s"} tracked
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. done:{" "}
                    <span className="font-medium text-foreground">
                      {order.dueDateAt?.toLocaleDateString() ?? "Not set"}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                <Link href={buildPageHref({ page: Math.max(1, page - 1), dateFrom, dateTo })}>
                  Previous
                </Link>
              </Button>
              {pageNumbers.map((pageNumber, index) => {
                const previous = pageNumbers[index - 1];
                const showGap = previous && pageNumber - previous > 1;
                return (
                  <div key={pageNumber} className="flex items-center gap-2">
                    {showGap && (
                      <span className="px-1 text-sm text-muted-foreground">...</span>
                    )}
                    <Button
                      asChild
                      variant={pageNumber === page ? "default" : "outline"}
                      size="sm"
                    >
                      <Link href={buildPageHref({ page: pageNumber, dateFrom, dateTo })}>
                        {pageNumber}
                      </Link>
                    </Button>
                  </div>
                );
              })}
              <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
                <Link href={buildPageHref({ page: Math.min(totalPages, page + 1), dateFrom, dateTo })}>
                  Next
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
