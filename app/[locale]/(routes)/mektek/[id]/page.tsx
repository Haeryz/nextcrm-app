import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";
import {
  getMektekCustomerTrackingLink,
  getMektekServiceOrderById,
} from "@/actions/mektek/service-orders";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import AddTimelineEntryForm from "./_components/AddTimelineEntryForm";
import CustomerTrackingLinkCard from "./_components/CustomerTrackingLinkCard";
import { statusMap } from "../_lib/constants";
import TechnicianAssignCard from "../_components/TechnicianAssignCard";
import VisitDiscountCard from "../_components/VisitDiscountCard";
import PaymentCard from "../_components/PaymentCard";
import WhatsAppComposer from "../_components/WhatsAppComposer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MektekDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.isAdmin;
  const order = await getMektekServiceOrderById(id);

  if (!order) notFound();

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : {};

  const vehicle = typeof tags.vehicle === "string" ? tags.vehicle : "Unknown vehicle";
  const phone = typeof tags.phone === "string" ? tags.phone : order.crm_accounts?.office_phone;
  const address =
    typeof tags.address === "string" ? tags.address : order.crm_accounts?.billing_street;
  const statusData = statusMap[order.taskStatus ?? "ACTIVE"] ?? statusMap.ACTIVE;

  type TimelineEntry = { id: string; date: Date; description: string; completed: boolean };

  const timelineFromTags: TimelineEntry[] = Array.isArray(tags.timeline)
    ? tags.timeline
        .map((item): TimelineEntry | null => {
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
          return { id: timelineId, date: createdAt, description, completed };
        })
        .filter((entry): entry is TimelineEntry => !!entry)
    : [];

  const trackingResult = await getMektekCustomerTrackingLink(order.id);
  const customerTrackingLink = trackingResult?.data?.link;

  const timeline = timelineFromTags.length
    ? timelineFromTags
    : [
        {
          id: "intake",
          date: order.createdAt ?? new Date(),
          description:
            "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.",
          completed: true,
        },
      ];

  return (
    <Container
      title={`MEKTEK — ${order.crm_accounts?.name ?? "Unknown customer"}`}
      description={`Service order detail · ID ${order.id}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: IDENTITAS + PROGRESS ── */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* IDENTITAS */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Identitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Customer ID</p>
                <p className="font-mono font-semibold text-foreground">
                  {order.crm_accounts?.id ?? "Unknown"}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Nama</p>
                <p className="font-semibold text-foreground">
                  {order.crm_accounts?.name ?? "Unknown customer"}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Kendaraan</p>
                <p className="font-semibold text-foreground">
                  {vehicle}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Telepon</p>
                <p className="font-semibold text-foreground">{phone ?? "-"}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Alamat</p>
                <p className="font-semibold text-foreground">
                  {address ?? "-"}
                </p>
              </div>
            </CardContent>
          </Card>

          <TechnicianAssignCard />
          <VisitDiscountCard visitCount={1} />

          {/* PROGRESS */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-foreground">
                  {statusData.progress}%
                </span>
                <Badge
                  variant={statusData.label === "Completed" ? "default" : "secondary"}
                >
                  {statusData.label}
                </Badge>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${statusData.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {timeline.filter((item) => item.completed).length} of {timeline.length} steps completed
              </p>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Estimated Done</p>
                <p className="font-semibold text-foreground">
                  {order.dueDateAt?.toLocaleDateString() ?? "Not set"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: PESANAN timeline ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {isAdmin && customerTrackingLink && (
            <CustomerTrackingLinkCard link={customerTrackingLink} />
          )}

          {isAdmin && <AddTimelineEntryForm serviceOrderId={order.id} />}

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Pesanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Dashed vertical connector line */}
                {timeline.length > 1 && (
                  <div
                    className="absolute left-1.75 top-5 border-l-2 border-dashed border-border"
                    style={{
                      height: `calc(100% - 2.5rem)`,
                    }}
                  />
                )}

                <div className="space-y-4">
                  {timeline.map((timelineItem) => (
                    <div key={timelineItem.id} className="relative flex gap-5">
                      {/* Timeline dot */}
                      <div
                        className={`mt-1 shrink-0 w-4 h-4 rounded-full border-2 z-10 ${
                          timelineItem.completed
                            ? "bg-foreground border-foreground"
                            : "bg-background border-muted-foreground"
                        }`}
                      />

                      {/* Order card */}
                      <Card
                        className={`flex-1 border shadow-sm ${
                          timelineItem.completed
                            ? "bg-card"
                            : "bg-muted/30"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">
                                {timelineItem.date
                                  ? timelineItem.date.toLocaleDateString()
                                  : "No date"}
                              </span>
                            </div>
                            {timelineItem.completed ? (
                              <Badge variant="default" className="text-xs">
                                Done
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            {timelineItem.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <PaymentCard />
          <WhatsAppComposer
            phone={phone ?? ""}
            customerName={order.crm_accounts?.name ?? "Customer"}
            trackingLink={customerTrackingLink ?? ""}
          />

          {/* Notes panel */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Catatan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.comments.length > 0 ? (
                <div className="space-y-3">
                  {order.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md border p-3">
                      <p className="text-sm text-foreground">{comment.comment}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {comment.assigned_user?.name ?? "Unknown"} · {comment.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Tidak ada catatan.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
