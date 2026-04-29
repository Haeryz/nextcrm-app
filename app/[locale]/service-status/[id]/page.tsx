import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Receipt } from "lucide-react";
import { getPublicMektekServiceOrder } from "@/actions/mektek/service-orders";
import { buildMektekInvoiceData } from "@/actions/mektek/invoice-pdf";
import { calculateProgress, getStatusMeta } from "@/app/[locale]/(routes)/mektek/_lib/constants";

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

  const latestTimeline = timeline[timeline.length - 1];
  const progress = calculateProgress(timeline, order.taskStatus);
  const statusMeta = getStatusMeta(order.taskStatus);
  const tokenQuery = `token=${encodeURIComponent(token)}`;
  const invoiceHref = `/api/mektek/service-orders/${order.id}/invoice?${tokenQuery}`;
  const receiptHref = `/api/mektek/service-orders/${order.id}/receipt?${tokenQuery}`;
  const invoiceDownloadHref = `${invoiceHref}&download=1`;
  const receiptDownloadHref = `${receiptHref}&download=1`;
  const invoiceData = buildMektekInvoiceData(order);
  const formatCurrency = (amount: number) =>
    amount.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,rgba(148,163,184,0.14),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,0.12),transparent_30%),hsl(var(--background))] px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border bg-card/95 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Customer Tracking
              </p>
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                MEKTEK Service Progress
              </h1>
              <p className="text-sm text-muted-foreground">
                Hai {customerName}, berikut update terkini untuk servis kendaraan Anda.
              </p>
            </div>
            <Badge
              variant={statusMeta.badgeVariant}
              className="h-fit px-3 py-1 text-xs"
            >
              {statusMeta.label}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="md:col-span-1 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Service ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm font-semibold">{order.id.slice(0, 8)}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">{vehicle}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                ETA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">
                {order.dueDateAt?.toLocaleDateString() ?? "Belum ditentukan"}
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1 border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-black">{progress}%</p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full ${statusMeta.barColor} rounded-full transition-all`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Invoice & Struk
              </CardTitle>
              <Badge variant={invoiceData.payment.status === "paid" ? "default" : "secondary"}>
                {invoiceData.payment.status === "paid"
                  ? "Lunas"
                  : invoiceData.payment.status === "partial"
                  ? "Dibayar Sebagian"
                  : "Belum Bayar"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal servis</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(invoiceData.financials.subtotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total tagihan</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(invoiceData.financials.grandTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sudah dibayar</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(invoiceData.financials.amountPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sisa bayar</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(invoiceData.financials.balanceDue)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Invoice</p>
                  <p className="text-xs text-muted-foreground">
                    Rincian tagihan servis kendaraan Anda.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1">
                  <a href={invoiceHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Lihat Invoice
                  </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <a href={invoiceDownloadHref} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Struk</p>
                  <p className="text-xs text-muted-foreground">
                    Bukti pembayaran dan ringkasan transaksi.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1">
                  <a href={receiptHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Lihat Struk
                  </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <a href={receiptDownloadHref} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Progress Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada update timeline.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      index === timeline.length - 1
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card"
                    }`}
                  >
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
                    <p className="text-sm font-semibold text-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Latest Update
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                {latestTimeline?.description || "Belum ada update."}
              </p>
              <p className="text-xs text-muted-foreground">
                {latestTimeline
                  ? `${latestTimeline.createdAt.toLocaleDateString()} · ${latestTimeline.createdAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "-"}
              </p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Service Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {order.content || "Catatan tambahan servis akan ditampilkan di sini."}
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="p-4 text-xs text-muted-foreground">
            Halaman ini bersifat privat. Tautan ini hanya menampilkan detail untuk satu layanan servis Anda.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
