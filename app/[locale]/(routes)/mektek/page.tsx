import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getMektekServiceOrders,
} from "@/actions/mektek/service-orders";
import NewServiceOrderForm from "./_components/NewServiceOrderForm";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import { statusMap } from "./_lib/constants";
import MektekSubNav from "./_components/MektekSubNav";
import ExcelExportButton from "./_components/ExcelExportButton";

export default async function MektekPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.isAdmin;
  const orders = await getMektekServiceOrders();

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

        <div className="space-y-4">
          {orders.length === 0 && (
            <Card className="border">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No service records yet. Use the form above to add the first AC service intake.
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

            const statusData = statusMap[order.taskStatus ?? "ACTIVE"] ?? statusMap.ACTIVE;
            const timelineCount = Array.isArray(tags.timeline) ? tags.timeline.length : 1;

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
                      <Badge
                        variant={statusData.label === "Completed" ? "default" : "secondary"}
                      >
                        {statusData.label}
                      </Badge>
                    </div>
                    <p className="font-bold text-lg text-foreground">
                      {order.crm_accounts?.name ?? "Unknown customer"}
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
                        AC Service
                      </span>
                    </div>
                  </div>

                  {/* Right: progress */}
                  <div className="flex flex-col items-end gap-2 shrink-0 w-40">
                    <span className="text-sm font-bold text-foreground">
                      {statusData.progress}%
                    </span>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all"
                        style={{ width: `${statusData.progress}%` }}
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
      </div>
    </Container>
  );
}
