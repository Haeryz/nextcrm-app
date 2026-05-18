import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import { Activity, Banknote, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import { canAccessMektekStaffArea } from "@/lib/mektek/permissions";
import { getMektekDashboardSummary } from "@/actions/mektek/dashboard";
import MektekSubNav from "../_components/MektekSubNav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusMeta } from "../_lib/constants";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

export default async function MektekDashboardPage() {
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

  const summary = await getMektekDashboardSummary();
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
        <MektekSubNav activeTab="dashboard" />

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
          <CardHeader>
            <CardTitle className="text-base">Recent orders needing attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service orders yet.</p>
            ) : (
              summary.recentOrders.map((order) => {
                const status = getStatusMeta(order.taskStatus);
                return (
                  <Link
                    key={order.id}
                    href={`/mektek/${order.id}`}
                    className="flex flex-col gap-3 rounded-md border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{order.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Due {order.dueDateAt?.toLocaleDateString("id-ID") ?? "Not set"}
                      </p>
                    </div>
                    <Badge variant={status.badgeVariant}>{status.label}</Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
