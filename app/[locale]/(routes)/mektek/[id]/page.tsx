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
import EstimatedDoneControl from "./_components/EstimatedDoneControl";
import ServiceOrderItemsEditor from "./_components/ServiceOrderItemsEditor";
import { getStatusMeta } from "../_lib/constants";
import PaymentCard from "../_components/PaymentCard";
import WhatsAppComposer from "../_components/WhatsAppComposer";
import InvoiceActions from "../_components/InvoiceActions";
import { buildMektekInvoiceData } from "@/actions/mektek/invoice-pdf";
import { normalizeMektekLineItems } from "@/lib/mektek/items";
import VisitDiscountCard from "../_components/VisitDiscountCard";
import {
  canAccessMektekStaffArea,
  canCreateMektekOrders,
  canManageMektekPayments,
  canManageMektekSchedule,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
} from "@/lib/mektek/permissions";
import {
  canEditMektekOrderItems,
  isMektekInvoiceAvailable,
  isMektekPaymentAvailable,
  isMektekReceiptAvailable,
  isMektekStorefrontPurchase,
} from "@/lib/mektek/order-lifecycle";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

type TimelineEntry = {
  id: string;
  date: Date;
  description: string;
};

function valueOrDash(value?: string | null) {
  return value && value.trim() ? value : "-";
}

export default async function MektekDetailPage({ params }: Props) {
  const { id, locale } = await params;
  const session = await getServerSession(authOptions);
  const canAccess = canAccessMektekStaffArea(session?.user);
  const canUpdateProgress = canUpdateMektekProgress(session?.user);
  const canUseCustomerTools = canUseMektekCustomerTools(session?.user);
  const canManagePayment = canManageMektekPayments(session?.user);
  const canManageSchedule = canManageMektekSchedule(session?.user);
  const canManageOrderItems = canCreateMektekOrders(session?.user);
  if (!canAccess) {
    return (
      <Container title="Pesanan Servis" description="Ruang kerja MekTek terbatas">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses ke pesanan servis MekTek ini.
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

  const vehicle = typeof tags.vehicle === "string" ? tags.vehicle : "Kendaraan tidak diketahui";
  const vehiclePlateNumber =
    typeof tags.vehiclePlateNumber === "string" ? tags.vehiclePlateNumber : undefined;
  const vehicleFleetNumber =
    typeof tags.vehicleFleetNumber === "string" ? tags.vehicleFleetNumber : undefined;
  const vehicleMileageKm =
    typeof tags.vehicleMileageKm === "number" ? tags.vehicleMileageKm : undefined;
  const customerName =
    typeof tags.customerName === "string" && tags.customerName.length > 0
      ? tags.customerName
      : "Pelanggan tidak diketahui";
  const customerId =
    typeof tags.catalogCustomerId === "string" && tags.catalogCustomerId.length > 0
      ? tags.catalogCustomerId
      : "Tidak diketahui";
  const phone = typeof tags.phone === "string" ? tags.phone : undefined;
  const address = typeof tags.address === "string" ? tags.address : undefined;
  const technicianTag =
    tags.technician && typeof tags.technician === "object" && !Array.isArray(tags.technician)
      ? (tags.technician as Record<string, unknown>)
      : {};
  const technicianName =
    (typeof tags.technicians === "string" ? tags.technicians : "") ||
    order.assigned_user?.name ||
    (typeof technicianTag.name === "string" ? technicianTag.name : "") ||
    (typeof technicianTag.email === "string" ? technicianTag.email : "") ||
    "Belum ditugaskan";

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
          const timelineId =
            typeof row.id === "string" ? row.id : `${createdAtValue}-${description}`;
          if (!description || Number.isNaN(createdAt.getTime())) return null;
          return { id: timelineId, date: createdAt, description };
        })
        .filter((entry): entry is TimelineEntry => !!entry)
    : [];

  const trackingResult = await getMektekCustomerTrackingLink(order.id, locale);
  const customerTrackingLink = trackingResult?.data?.link;
  const timeline = timelineFromTags.length
    ? timelineFromTags
    : [
        {
          id: "intake",
          date: order.createdAt ?? new Date(),
          description:
            "Layanan Anda telah terbuat. Tim kami sedang menyiapkan pemeriksaan awal kendaraan.",
        },
      ];
  const statusMeta = getStatusMeta(order.taskStatus);
  const invoiceData = buildMektekInvoiceData(order);
  const normalizedItems = normalizeMektekLineItems(tags, order.content);
  const paymentMethod = ["cash", "transfer", "qris"].includes(invoiceData.payment.method)
    ? (invoiceData.payment.method as "cash" | "transfer" | "qris")
    : "cash";
  const isStorefrontPurchase = isMektekStorefrontPurchase(tags);
  const invoiceAvailable = isMektekInvoiceAvailable({
    taskStatus: order.taskStatus,
    tags,
    paymentStatus: invoiceData.payment.status,
  });
  const receiptAvailable = isMektekReceiptAvailable({
    taskStatus: order.taskStatus,
    tags,
    paymentStatus: invoiceData.payment.status,
  });
  const paymentStageOpen =
    order.taskStatus === "AWAITING_PAYMENT" || isStorefrontPurchase;
  const canRecordPayment =
    canManagePayment &&
    paymentStageOpen &&
    isMektekPaymentAvailable({
      taskStatus: order.taskStatus,
      tags,
      balanceDue: invoiceData.financials.balanceDue,
    });
  const completedVisitCount =
    typeof tags.completedVisitCount === "number" ? tags.completedVisitCount : 0;
  const canAddOrderItems =
    canManageOrderItems && canEditMektekOrderItems(order.taskStatus);

  return (
    <Container
      title="Pesanan Servis"
      description={`${customerName} · ${vehicle} · ID ${order.id.slice(0, 8)}`}
    >
      <div className="space-y-6">
        <Card className="border shadow-sm">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                  <span className="break-all font-mono text-xs text-muted-foreground">
                    {order.id}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {customerName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {vehicle}
                    {vehiclePlateNumber ? ` · ${vehiclePlateNumber}` : ""}
                    {vehicleFleetNumber ? ` · Lambung ${vehicleFleetNumber}` : ""}
                    {vehicleMileageKm !== undefined
                      ? ` · ${vehicleMileageKm.toLocaleString("id-ID")} KM`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-sm rounded-lg border bg-muted/20 p-4 lg:shrink-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status saat ini
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <Badge
                    variant={statusMeta.badgeVariant}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                  >
                    {statusMeta.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {timeline.length} pembaruan timeline
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pelanggan & Servis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">ID Pelanggan</p>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {customerId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="text-sm font-medium text-foreground">
                      {order.dueDateAt?.toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Makassar",
                      }) ?? "Belum diatur"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teknisi</p>
                    <p className="text-sm font-medium text-foreground">
                      {technicianName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telepon</p>
                    <p className="text-sm font-medium text-foreground">
                      {valueOrDash(phone)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alamat</p>
                    <p className="text-sm font-medium text-foreground">
                      {valueOrDash(address)}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Catatan Servis</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {order.content || "Belum ada catatan servis."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Servis & Sparepart</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Deskripsi Servis</p>
                      <Badge variant="secondary">
                        {normalizedItems.serviceItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {normalizedItems.serviceItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada item servis.</p>
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
                      <p className="text-sm font-semibold">Daftar Sparepart</p>
                      <Badge variant="secondary">
                        {normalizedItems.sparepartItems.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {normalizedItems.sparepartItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada sparepart.</p>
                      ) : (
                        normalizedItems.sparepartItems.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="text-sm">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} x {item.unitPrice.toLocaleString("id-ID")} IDR
                              {item.partNumber ? ` · ${item.partNumber}` : ""}
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
                {canAddOrderItems && (
                  <ServiceOrderItemsEditor serviceOrderId={order.id} />
                )}
                {canManageOrderItems && !canAddOrderItems && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    {order.taskStatus === "COMPLETE"
                      ? "Service Items dan sparepart dikunci permanen karena Order ini telah ditutup."
                      : "Service Items dan sparepart dikunci selama Payment Review. Ubah Order kembali ke In Progress sebelum menambah pekerjaan."}
                  </div>
                )}
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
                        className="mt-1 size-3 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {timelineItem.date.toLocaleDateString()} ·{" "}
                          {timelineItem.date.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {timelineItem.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          <aside className="min-w-0 space-y-6">
            <VisitDiscountCard visitCount={completedVisitCount} />

            {canManageSchedule && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Jadwal</CardTitle>
                </CardHeader>
                <CardContent>
                  <EstimatedDoneControl
                    serviceOrderId={order.id}
                    estimatedDone={order.dueDateAt?.toISOString() ?? null}
                  />
                </CardContent>
              </Card>
            )}

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
                    locale={locale}
                    serviceOrderId={order.id}
                    currentStatus={order.taskStatus ?? "ACTIVE"}
                    balanceDue={invoiceData.financials.balanceDue}
                    showCloseAction={canManagePayment}
                  />
                </CardContent>
              </Card>
            )}

            {(canManagePayment || canUseCustomerTools) && (
              <Tabs defaultValue={canRecordPayment ? "payment" : "docs"} className="min-w-0 space-y-4">
                <TabsList className={`grid h-auto w-full ${canRecordPayment ? "grid-cols-3" : "grid-cols-2"}`}>
                  {canRecordPayment && <TabsTrigger value="payment">Pembayaran</TabsTrigger>}
                  <TabsTrigger value="docs" className="text-xs sm:text-sm">Dokumen</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="text-xs sm:text-sm">WhatsApp</TabsTrigger>
                </TabsList>
                {canRecordPayment && (
                  <TabsContent value="payment" className="mt-0">
                    <PaymentCard
                      serviceOrderId={order.id}
                      serviceSubtotal={invoiceData.financials.serviceSubtotal}
                      sparepartSubtotal={invoiceData.financials.sparepartSubtotal}
                      initialDiscount={invoiceData.financials.discount}
                      customerType={invoiceData.customer.type}
                      initialPpnEnabled={invoiceData.financials.ppnEnabled}
                      initialPphEnabled={invoiceData.financials.pphEnabled}
                      canManageTaxSettings={!!session?.user?.isAdmin}
                      initialAmountPaid={invoiceData.financials.amountPaid}
                      initialProviderAmountPaid={invoiceData.payment.providerAmountPaid}
                      initialMethod={paymentMethod}
                      providerPayments={invoiceData.payment.providerPayments}
                    />
                  </TabsContent>
                )}
                <TabsContent value="docs" className="mt-0">
                  <InvoiceActions
                    serviceOrderId={order.id}
                    invoiceAvailable={invoiceAvailable}
                    receiptAvailable={receiptAvailable}
                  />
                </TabsContent>
                <TabsContent value="whatsapp" className="mt-0">
                  <WhatsAppComposer
                    serviceOrderId={order.id}
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
