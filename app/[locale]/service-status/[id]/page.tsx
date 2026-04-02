import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";

const statusMap: Record<string, { label: string; progress: number }> = {
  ACTIVE: { label: "In Progress", progress: 65 },
  PENDING: { label: "Pending", progress: 35 },
  COMPLETE: { label: "Completed", progress: 100 },
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ServiceStatusPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  const order = await getPublicMektekServiceOrder(id, token);
  if (!order) notFound();

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : {};

  const customerName = order.crm_accounts?.name || "Customer";
  const vehicle = typeof tags.vehicle === "string" ? tags.vehicle : "Unknown vehicle";
  const statusData = statusMap[order.taskStatus ?? "ACTIVE"] ?? statusMap.ACTIVE;

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Service Progress</p>
          <h1 className="text-3xl font-bold">{customerName}</h1>
          <p className="text-muted-foreground">{vehicle}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Current Status</span>
              <Badge variant={statusData.label === "Completed" ? "default" : "secondary"}>
                {statusData.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${statusData.progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">Progress: {statusData.progress}%</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Complaint</p>
                <p className="font-medium">{order.content || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estimated done</p>
                <p className="font-medium">{order.dueDateAt?.toLocaleDateString() ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{order.createdAt?.toLocaleDateString() ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last update</p>
                <p className="font-medium">{order.updatedAt?.toLocaleDateString() ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}