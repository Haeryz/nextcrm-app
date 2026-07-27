import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  UserRound,
} from "lucide-react";
import Link from "next/link";
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
  canCreateMektekOrders,
  canManageMektekPayments,
  canManageMektekSchedule,
  canUpdateMektekProgress,
  canUseMektekCustomerTools,
  canViewMektekOrders,
} from "@/lib/mektek/permissions";
import {
  canEditMektekOrderItems,
  isMektekInvoiceAvailable,
  isMektekPaymentAvailable,
  isMektekReceiptAvailable,
  isMektekStorefrontPurchase,
} from "@/lib/mektek/order-lifecycle";
import { isUuid } from "@/lib/uuid";

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
  if (!isUuid(id)) notFound();

  const session = await getServerSession(authOptions);
  const canAccess = canViewMektekOrders(session?.user);
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
  const customerContactName =
    typeof tags.customerContactName === "string" && tags.customerContactName.trim()
      ? tags.customerContactName
      : undefined;
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
      description={`${customerName} · ${vehicle} · No. Service ${
        order.serviceNumber ?? order.id.slice(0, 8)
      }`}
    >
      <div className="min-w-0 space-y-4 sm:space-y-6">
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="-ms-2 h-8 w-fit shrink-0 text-muted-foreground"
                >
                  <Link href={`/${locale}/mektek`}>
                    <ArrowLeft data-icon="inline-start" />
                    Kembali
                  </Link>
                </Button>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  No. Service {order.serviceNumber ?? order.id.slice(0, 8)}
                </span>
                <Badge
                  variant={statusMeta.badgeVariant}
                  className="max-w-full whitespace-normal"
                >
                  {statusMeta.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timeline.length} pembaruan
                </span>
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {customerName}
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  {vehicle}
                  {vehiclePlateNumber ? ` · ${vehiclePlateNumber}` : ""}
                  {vehicleFleetNumber ? ` · Lambung ${vehicleFleetNumber}` : ""}
                  {vehicleMileageKm !== undefined
                    ? ` · ${vehicleMileageKm.toLocaleString("id-ID")} KM`
                    : ""}
                  {customerContactName ? ` · PIC ${customerContactName}` : ""}
                </p>
              </div>

              <dl className="grid min-w-0 gap-2 min-[480px]:grid-cols-3">
                <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CircleDollarSign className="size-3.5" aria-hidden="true" />
                    Sisa tagihan
                  </dt>
                  <dd className="mt-0.5 break-words font-mono text-sm font-semibold tabular-nums">
                    Rp {invoiceData.financials.balanceDue.toLocaleString("id-ID")}
                  </dd>
                </div>
                <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    Estimasi selesai
                  </dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold">
                    {order.dueDateAt?.toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Makassar",
                    }) ?? "Belum diatur"}
                  </dd>
                </div>
                <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <UserRound className="size-3.5" aria-hidden="true" />
                    Teknisi
                  </dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold">
                    {technicianName}
                  </dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_352px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="contents">
            <Card className="order-2 border shadow-sm lg:col-start-1 lg:row-start-1">
              <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-base">Pelanggan & Servis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">ID Pelanggan</p>
                    <p className="break-all font-mono text-sm font-medium text-foreground">
                      {customerId}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Telepon</p>
                    <p className="break-all text-sm font-medium text-foreground">
                      {valueOrDash(phone)}
                    </p>
                  </div>
                  <div className="min-w-0 md:col-span-2 lg:col-span-1 xl:col-span-2">
                    <p className="text-xs text-muted-foreground">Alamat</p>
                    <p className="break-words text-sm font-medium text-foreground">
                      {valueOrDash(address)}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Catatan Servis</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {order.content || "Belum ada catatan servis."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="order-3 border shadow-sm lg:col-start-1 lg:row-start-2">
              <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-base">Servis & Sparepart</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="min-w-0 rounded-lg border p-3 sm:p-4">
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
                          <div key={`${item.name}-${index}`} className="min-w-0 text-sm">
                            <p className="break-words font-medium">{item.name}</p>
                            <p className="break-words text-xs text-muted-foreground">
                              {item.quantity} x Rp {item.unitPrice.toLocaleString("id-ID")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="mt-3 break-words border-t pt-3 font-mono text-sm font-semibold">
                      Subtotal: Rp {normalizedItems.serviceSubtotal.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-lg border p-3 sm:p-4">
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
                          <div key={`${item.name}-${index}`} className="min-w-0 text-sm">
                            <p className="break-words font-medium">{item.name}</p>
                            <p className="break-words text-xs text-muted-foreground">
                              {item.quantity} x Rp {item.unitPrice.toLocaleString("id-ID")}
                              {item.partNumber ? ` · ${item.partNumber}` : ""}
                              {item.stockWarehouse
                                ? ` · ${
                                    item.stockWarehouse === "FRONT"
                                      ? "Gudang Depan"
                                      : "Gudang Belakang"
                                  }`
                                : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="mt-3 break-words border-t pt-3 font-mono text-sm font-semibold">
                      Subtotal: Rp {normalizedItems.sparepartSubtotal.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                {canAddOrderItems && (
                  <ServiceOrderItemsEditor
                    serviceOrderId={order.id}
                    initialSparepartItems={normalizedItems.sparepartItems.map(
                      (item, index) => ({
                        clientId: `stored-sparepart-${index}`,
                        description: item.name,
                        estimatedCost: String(item.unitPrice),
                        quantity: item.quantity,
                        catalogItemId: item.catalogItemId ?? undefined,
                        machine: item.machine ?? undefined,
                        partNumber: item.partNumber ?? undefined,
                        catalogPartNumber:
                          item.catalogPartNumber ?? undefined,
                        stockWarehouse: item.stockWarehouse ?? undefined,
                      }),
                    )}
                  />
                )}
                {canManageOrderItems && !canAddOrderItems && (
                  <div className="break-words rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    {order.taskStatus === "CANCELLED"
                      ? "Item servis dan sparepart dikunci permanen karena pesanan ini telah dibatalkan."
                      : "Item servis dan sparepart dikunci permanen karena pesanan ini telah ditutup."}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="order-4 border shadow-sm lg:col-start-1 lg:row-start-3">
              <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                <CardTitle className="text-base">Riwayat Pengerjaan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
                {canUpdateProgress && <AddTimelineEntryForm serviceOrderId={order.id} />}

                <div className="space-y-3">
                  {timeline.map((timelineItem) => (
                    <div
                      key={timelineItem.id}
                      className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] gap-3 rounded-lg border p-3 sm:p-4"
                    >
                      <span
                        className="mt-1 size-3 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {timelineItem.date.toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Makassar",
                          })}
                        </p>
                        <p className="break-words text-sm font-medium text-foreground">
                          {timelineItem.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>

          <aside className="order-1 min-w-0 space-y-4 sm:space-y-6 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:max-h-[calc(100svh-2rem)] lg:self-start lg:overflow-y-auto lg:pe-1">
            {(canUpdateProgress || canManageOrderItems) && (
              <Card className="border shadow-sm">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-base">Status</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <ServiceOrderStatusControl
                    locale={locale}
                    serviceOrderId={order.id}
                    currentStatus={order.taskStatus ?? "ACTIVE"}
                    balanceDue={invoiceData.financials.balanceDue}
                    showCloseAction={canManagePayment}
                    canChangeStatus={canUpdateProgress}
                    canCancel={canManageOrderItems}
                  />
                </CardContent>
              </Card>
            )}

            {canManageSchedule && (
              <Card className="border shadow-sm">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-base">Jadwal</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <EstimatedDoneControl
                    serviceOrderId={order.id}
                    estimatedDone={order.dueDateAt?.toISOString() ?? null}
                  />
                </CardContent>
              </Card>
            )}

            {(canManagePayment || canUseCustomerTools) && (
              <Tabs defaultValue={canRecordPayment ? "payment" : "docs"} className="min-w-0 space-y-4">
                <TabsList className={`grid h-auto w-full gap-1 ${canRecordPayment ? "grid-cols-1 min-[480px]:grid-cols-3" : "grid-cols-2"}`}>
                  {canRecordPayment && <TabsTrigger value="payment" className="w-full whitespace-normal px-2 text-xs xl:text-sm">Pembayaran</TabsTrigger>}
                  <TabsTrigger value="docs" className="w-full whitespace-normal px-2 text-xs xl:text-sm">Dokumen</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="w-full whitespace-normal px-2 text-xs xl:text-sm">WhatsApp</TabsTrigger>
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

            {canUseCustomerTools && customerTrackingLink && (
              <CustomerTrackingLinkCard link={customerTrackingLink} />
            )}

            <VisitDiscountCard visitCount={completedVisitCount} />
          </aside>
        </div>
      </div>
    </Container>
  );
}
