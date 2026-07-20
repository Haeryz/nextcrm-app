import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Activity, Banknote, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { getMektekDashboardSummary } from "@/actions/mektek/dashboard";
import { authOptions } from "@/lib/auth";
import { canViewMektekDashboard } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MektekOrderList from "../_components/MektekOrderList";
import MektekPagination from "../_components/MektekPagination";
import MektekDashboardInsights from "./_components/MektekDashboardInsights";
import { redirect } from "next/navigation";

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
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  if (!canViewMektekDashboard(session?.user)) {
    redirect(`/${locale}/mektek`);
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
    { label: "Pesanan terbuka", value: summary.openOrders, icon: Activity },
    { label: "Jatuh tempo hari ini", value: summary.dueToday, icon: CalendarClock },
    { label: "Terlambat", value: summary.overdue, icon: Clock3 },
    { label: "Selesai hari ini", value: summary.completedToday, icon: CheckCircle2 },
    { label: "Sisa belum dibayar", value: formatCurrency(summary.unpaidBalance), icon: Banknote },
  ];

  return (
    <Container
      title="MEKTEK Dashboard"
      description="Ringkasan operasional, penjualan, dan pelanggan MekTek"
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

        <MektekDashboardInsights
          analytics={summary.analytics}
          itemActivity={summary.itemActivity}
        />

        <Card>
          <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Pesanan terbaru</CardTitle>
            <p className="text-sm text-muted-foreground">
              Halaman {summary.recentOrdersPage} dari {summary.recentOrdersTotalPages}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <MektekOrderList
              orders={summary.recentOrders}
              emptyMessage="Belum ada pesanan servis."
              density="compact"
              locale={locale}
            />
            <MektekPagination
              basePath={`/${locale}/mektek/dashboard`}
              page={summary.recentOrdersPage}
              totalPages={summary.recentOrdersTotalPages}
              totalCount={summary.recentOrdersTotalCount}
              pageSize={summary.recentOrdersPageSize}
              itemLabel="pesanan"
              pageParam="ordersPage"
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
