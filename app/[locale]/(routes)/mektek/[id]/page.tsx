import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notFound } from "next/navigation";
import {
  getMektekCustomerTrackingLink,
  getMektekServiceOrderById,
} from "@/actions/mektek/service-orders";
import { getServerSession } from "@/lib/session";
import { authOptions } from "@/lib/auth";
import AddTimelineEntryForm from "./_components/AddTimelineEntryForm";
import CustomerTrackingLinkCard from "./_components/CustomerTrackingLinkCard";
import ServiceOrderStatusControl from "./_components/ServiceOrderStatusControl";
import { calculateProgress, getStatusMeta } from "../_lib/constants";
import PaymentCard from "../_components/PaymentCard";
import WhatsAppComposer from "../_components/WhatsAppComposer";
import InvoiceActions from "../_components/InvoiceActions";
import { buildMektekInvoiceData } from "@/actions/mektek/invoice-pdf";
import { normalizeMektekLineItems } from "@/lib/mektek/items";
import VisitDiscountCard from "../_components/VisitDiscountCard";
import {
  canAccessMektekStaffArea,
  canManageMektekPayments,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";

interface Props {
  params: Promise<{ id: string }>;
}

type TimelineEntry = {
  id: string;
  date: Date;
  description: string;
  completed: boolean;
};

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : "-";
}

export default async function MektekDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const canAccess = canAccessMektekStaffArea(session?.user);
  const canUpdateProgress = canUpdateMektekProgress(session?.user);
  const canUseCustomerTools = canUseMektekCustomerTools(session?.user);
  const canManagePayment = canManageMektekPayments(session?.user);
  if (!canAccess) {
    return (
      <Container title="Service Order" description="Restricted MekTek workspace">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have access to this MekTek service order.
          </CardContent>
        </Card>
      </Container>
    );
  }
  const order = await getMektekServiceOrderById(id);

  if (!order) notFound();

  const tags =
    order.tags && typeof order.tags === "object" && !Array.isArray(order.tags)
      ? (order.tags as Record<string, unknown>)
      : {};

  const vehicle = typeof tags.vehicle === "string" ? tags.vehicle : "Unknown vehicle";
  const customerName =
    typeof tags.customerName === "string" && tags.customerName.length > 0
      ? tags.customerName
      : "Unknown customer";
  const customerId =
    typeof tags.catalogCustomerId === "string" && tags.catalogCustomerId.length > 0
      ? tags.catalogCustomerId
      : "Unknown";
  const phone = typeof tags.phone === "string" ? tags.phone : undefined;
  const address = typeof tags.address === "string" ? tags.address : undefined;
  const technicianTag =
    tags.technician && typeof tags.technician === "object" && !Array.isArray(tags.technician)
      ? (tags.technician as Record<string, unknown>)
      : {};
  const technicianName =
    order.assigned_user?.name ||
    (typeof technicianTag.name === "string" ? technicianTag.name : "") ||
    (typeof technicianTag.email === "string" ? technicianTag.email : "") ||
    "Unassigned";

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
  const completedSteps = timeline.filter((item) => item.completed).length;
  const progress = calculateProgress(timelineFromTags, order.taskStatus);
  const statusMeta = getStatusMeta(order.taskStatus);
  const invoiceData = buildMektekInvoiceData(order);
  const normalizedItems = normalizeMektekLineItems(tags, order.content);
  const paymentMethod = ["cash", "transfer", "qris"].includes(invoiceData.payment.method)
    ? (invoiceData.payment.method as "cash" | "transfer" | "qris")
    : "cash";
  const completedVisitCount =
    typeof tags.completedVisitCount === "number" ? tags.completedVisitCount : 0;

  return (
    <Container
      title="Service Order"
      description={`${customerName} · ${vehicle} · ID ${order.id.slice(0, 8)}`}
    >
      <div className="space-y-6">
        <Card className="border shadow-sm">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {order.id}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {customerName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {vehicle}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Progress</span>
                  <span className="text-2xl font-bold text-foreground">{progress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${statusMeta.barColor} rounded-full transition-all`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedSteps} of {timeline.length} steps completed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customer & Service</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Customer ID</p>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {customerId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Done</p>
                    <p className="text-sm font-medium text-foreground">
                      {order.dueDateAt?.toLocaleDateString() ?? "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Technician</p>
                    <p className="text-sm font-medium text-foreground">
                      {technicianName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium text-foreground">
                      {valueOrDash(phone)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-medium text-foreground">
                      {valueOrDash(address)}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Service Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {order.content || "No service notes yet."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Service & Sparepart</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Service Items</p>
                      <Badge variant="secondary">
                        {normalizedItems.serviceItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {normalizedItems.serviceItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No service items.</p>
                      ) : (
                        normalizedItems.serviceItems.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="text-sm">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} x {item.unitPrice.toLocaleString("id-ID")} IDR
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="mt-3 border-t pt-3 text-sm font-semibold">
                      Subtotal: {normalizedItems.serviceSubtotal.toLocaleString("id-ID")} IDR
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Sparepart Items</p>
                      <Badge variant="secondary">
                        {normalizedItems.sparepartItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {normalizedItems.sparepartItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sparepart items.</p>
                      ) : (
                        normalizedItems.sparepartItems.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="text-sm">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} x {item.unitPrice.toLocaleString("id-ID")} IDR
                              {item.catalogPartNumber || item.partNumber
                                ? ` · ${item.catalogPartNumber || item.partNumber}`
                                : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="mt-3 border-t pt-3 text-sm font-semibold">
                      Subtotal: {normalizedItems.sparepartSubtotal.toLocaleString("id-ID")} IDR
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Work Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {canUpdateProgress && <AddTimelineEntryForm serviceOrderId={order.id} />}

                <div className="space-y-3">
                  {timeline.map((timelineItem) => (
                    <div
                      key={timelineItem.id}
                      className="grid grid-cols-[16px_1fr] gap-3 rounded-lg border p-4"
                    >
                      <span
                        className={`mt-1 size-3 rounded-full ${
                          timelineItem.completed ? "bg-foreground" : "bg-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {timelineItem.date.toLocaleDateString()} ·{" "}
                            {timelineItem.date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <Badge variant={timelineItem.completed ? "default" : "secondary"}>
                            {timelineItem.completed ? "Done" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {timelineItem.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {order.comments.length > 0 ? (
                  <div className="space-y-3">
                    {order.comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border p-3">
                        <p className="text-sm text-foreground">{comment.comment}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {comment.assigned_user?.name ?? "Unknown"} ·{" "}
                          {comment.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No internal notes yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <VisitDiscountCard visitCount={completedVisitCount} />

            {canUseCustomerTools && customerTrackingLink && (
              <CustomerTrackingLinkCard link={customerTrackingLink} />
            )}

            {canUpdateProgress && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ServiceOrderStatusControl
                    serviceOrderId={order.id}
                    currentStatus={order.taskStatus ?? "ACTIVE"}
                  />
                </CardContent>
              </Card>
            )}

            {(canManagePayment || canUseCustomerTools) && (
              <Tabs defaultValue={canManagePayment ? "payment" : "docs"} className="space-y-4">
                <TabsList className={`grid w-full ${canManagePayment ? "grid-cols-3" : "grid-cols-2"}`}>
                  {canManagePayment && <TabsTrigger value="payment">Payment</TabsTrigger>}
                  <TabsTrigger value="docs">Docs</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                </TabsList>
                {canManagePayment && (
                  <TabsContent value="payment" className="mt-0">
                    <PaymentCard
                      serviceOrderId={order.id}
                      serviceSubtotal={invoiceData.financials.serviceSubtotal}
                      sparepartSubtotal={invoiceData.financials.sparepartSubtotal}
                      initialDiscount={invoiceData.financials.discount}
                      initialTax={invoiceData.financials.tax}
                      initialAmountPaid={invoiceData.financials.amountPaid}
                      initialMethod={paymentMethod}
                    />
                  </TabsContent>
                )}
                <TabsContent value="docs" className="mt-0">
                  <InvoiceActions serviceOrderId={order.id} />
                </TabsContent>
                <TabsContent value="whatsapp" className="mt-0">
                  <WhatsAppComposer
                    phone={phone ?? ""}
                    customerName={customerName}
                    trackingLink={customerTrackingLink ?? ""}
                  />
                </TabsContent>
              </Tabs>
            )}
          </aside>
        </div>
      </div>
    </Container>
  );
}
