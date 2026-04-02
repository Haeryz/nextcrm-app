import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { Separator } from "@/components/ui/separator";

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

  const timeline = Array.isArray(tags.timeline)
    ? tags.timeline
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          const description =
            typeof row.description === "string" ? row.description.trim() : "";
          const createdAtValue =
            typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString();
          const createdAt = new Date(createdAtValue);
          const completed = typeof row.completed === "boolean" ? row.completed : true;
          const timelineId =
            typeof row.id === "string" ? row.id : `${createdAtValue}-${description}`;

          if (!description || Number.isNaN(createdAt.getTime())) return null;
          return {
            id: timelineId,
            description,
            createdAt,
            completed,
          };
        })
        .filter(
          (entry): entry is {
            id: string;
            description: string;
            createdAt: Date;
            completed: boolean;
          } => !!entry
        )
    : [];

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 rounded-xl border bg-card p-4 md:p-5">
          <p className="text-xs text-muted-foreground">Customer</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">MEKTEK</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau progres servis kendaraan Anda secara real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground text-center">
                  Identitas
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-44 space-y-2 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm">
                  <span className="font-semibold">Nama:</span> {customerName}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Kendaraan:</span> {vehicle}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">ID Servis:</span> {order.id.slice(0, 8)}
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground text-center">
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-44 space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black">{statusData.progress}%</span>
                  <Badge variant={statusData.label === "Completed" ? "default" : "secondary"}>
                    {statusData.label}
                  </Badge>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${statusData.progress}%` }} />
                </div>
                <Separator />
                <p className="text-sm">
                  <span className="font-semibold">Estimasi selesai:</span>{" "}
                  {order.dueDateAt?.toLocaleDateString() ?? "Belum ditentukan"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground text-center">
                Pesanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {timeline.length > 1 && (
                  <div
                    className="absolute left-1.75 top-5 border-l-2 border-dashed border-border"
                    style={{ height: "calc(100% - 2.5rem)" }}
                  />
                )}

                <div className="space-y-4">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada update timeline.</p>
                  ) : (
                    timeline.map((item) => (
                      <div key={item.id} className="relative flex gap-4">
                        <div
                          className={`mt-1 h-4 w-4 rounded-full border-2 z-10 ${
                            item.completed
                              ? "border-foreground bg-foreground"
                              : "border-muted-foreground bg-background"
                          }`}
                        />
                        <Card className="flex-1 border shadow-sm">
                          <CardContent className="p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold text-muted-foreground">
                              {item.createdAt.toLocaleDateString()} ·{" "}
                              {item.createdAt.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              </p>
                              <Badge variant={item.completed ? "default" : "secondary"}>
                                {item.completed ? "Done" : "Pending"}
                              </Badge>
                            </div>
                            <p className="text-base font-semibold text-foreground">{item.description}</p>
                          </CardContent>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 border shadow-sm">
          <CardContent className="min-h-24 p-4 text-sm text-muted-foreground">
            {order.content || "Catatan tambahan servis akan ditampilkan di sini."}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}