import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Activity, Banknote, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { getMektekDashboardSummary } from "@/actions/mektek/dashboard";
import { authOptions } from "@/lib/auth";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MektekOrderList from "../_components/MektekOrderList";
import MektekPagination from "../_components/MektekPagination";

interface MektekDashboardPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const DASHBOARD_ORDER_PAGE_SIZE = 6;

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MektekDashboardPage({
  params,
  searchParams,
}: MektekDashboardPageProps) {
  const { locale = "en" } = params ? await params : { locale: "en" };
  const session = await getServerSession(authOptions);
  if (!canAccessMektekStaffArea(session?.user)) {
    return (
      <Container title="MEKTEK" description="Operational dashboard">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have access to the MekTek staff dashboard.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const ordersPage = Math.max(
    Number(readSearchParam(resolvedSearchParams, "ordersPage")) || 1,
    1
  );
  const summary = await getMektekDashboardSummary(undefined, {
    recentOrdersPage: ordersPage,
    recentOrdersPageSize: DASHBOARD_ORDER_PAGE_SIZE,
  });
  const stats = [
    { label: "Open orders", value: summary.openOrders, icon: Activity },
    { label: "Due today", value: summary.dueToday, icon: CalendarClock },
    { label: "Overdue", value: summary.overdue, icon: Clock3 },
    { label: "Completed today", value: summary.completedToday, icon: CheckCircle2 },
    { label: "Unpaid balance", value: formatCurrency(summary.unpaidBalance), icon: Banknote },
  ];

  return (
    <Container
      title="MEKTEK Dashboard"
      description="Operational view of current service work"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Page {summary.recentOrdersPage} of {summary.recentOrdersTotalPages}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <MektekOrderList
              orders={summary.recentOrders}
              emptyMessage="No service orders yet."
              density="compact"
              locale={locale}
            />
            <MektekPagination
              basePath={`/${locale}/mektek/dashboard`}
              page={summary.recentOrdersPage}
              totalPages={summary.recentOrdersTotalPages}
              totalCount={summary.recentOrdersTotalCount}
              pageSize={summary.recentOrdersPageSize}
              itemLabel="orders"
              pageParam="ordersPage"
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
