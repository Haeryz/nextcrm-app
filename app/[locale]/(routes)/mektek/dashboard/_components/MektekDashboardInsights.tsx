import React from "react";
import {
  Banknote,
  Crown,
  Package,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { MektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";

const formatCurrency = (amount: number) =>
  amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const formatCompactCurrency = (amount: number) =>
  `Rp${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount)}`;

const STATUS_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

function InsightKpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function OrderValueTrend({
  points,
}: {
  points: MektekDashboardAnalytics["orderValueTrend"];
}) {
  const width = 760;
  const height = 240;
  const plotLeft = 72;
  const plotRight = 24;
  const plotTop = 20;
  const plotBottom = 194;
  const highestValue = Math.max(...points.map((point) => point.orderValue), 0);
  const hasData = highestValue > 0;
  const maxValue = Math.max(highestValue, 1);
  const xStep = (width - plotLeft - plotRight) / Math.max(points.length - 1, 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: plotLeft + index * xStep,
    y:
      plotBottom -
      (point.orderValue / maxValue) * (plotBottom - plotTop),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? plotLeft} ${plotBottom} L ${coordinates[0]?.x ?? plotLeft} ${plotBottom} Z`;
  const yTicks = hasData ? [1, 0.5, 0] : [0];

  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Tren nilai pesanan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nilai seluruh pesanan dalam enam bulan terakhir
          </p>
        </div>
        <TrendingUp className="size-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[620px]"
            role="img"
            aria-label="Grafik nilai pesanan MekTek selama enam bulan terakhir"
          >
            <defs>
              <linearGradient id="mektek-order-value-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {yTicks.map((tick) => {
              const y = plotTop + (1 - tick) * (plotBottom - plotTop);
              return (
                <g key={tick}>
                  <line
                    x1={plotLeft}
                    x2={width - plotRight}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={plotLeft - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {formatCompactCurrency(maxValue * tick)}
                  </text>
                </g>
              );
            })}
            {hasData && (
              <>
                <path d={areaPath} fill="url(#mektek-order-value-area)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {!hasData && (
              <text
                x={(plotLeft + width - plotRight) / 2}
                y={(plotTop + plotBottom) / 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[13px]"
              >
                Belum ada nilai pesanan untuk periode ini
              </text>
            )}
            {coordinates.map((point) => (
              <g key={point.key}>
                {hasData && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                  >
                    <title>
                      {point.label}: {formatCurrency(point.orderValue)} dari {point.orderCount} pesanan
                    </title>
                  </circle>
                )}
                <text
                  x={point.x}
                  y={plotBottom + 27}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[12px]"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDistribution({
  statuses,
}: {
  statuses: MektekDashboardAnalytics["statusDistribution"];
}) {
  const total = statuses.reduce((sum, status) => sum + status.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Distribusi status</CardTitle>
        <p className="text-sm text-muted-foreground">Komposisi seluruh pesanan</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="mx-auto size-44">
          <svg viewBox="0 0 120 120" className="size-full" role="img" aria-label="Distribusi status pesanan">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="14"
            />
            {statuses.map((status, index) => {
              const segment = total > 0 ? (status.count / total) * circumference : 0;
              const offset = -consumed;
              consumed += segment;
              return (
                <circle
                  key={status.key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={STATUS_COLORS[index] ?? "hsl(var(--muted-foreground))"}
                  strokeWidth="14"
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 60 60)"
                >
                  <title>{status.label}: {status.count}</title>
                </circle>
              );
            })}
            <text x="60" y="57" textAnchor="middle" className="fill-foreground text-[20px] font-semibold">
              {total}
            </text>
            <text x="60" y="73" textAnchor="middle" className="fill-muted-foreground text-[8px] uppercase tracking-wide">
              Pesanan
            </text>
          </svg>
        </div>
        <div className="space-y-2">
          {statuses.map((status, index) => (
            <div key={status.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      STATUS_COLORS[index] ?? "hsl(var(--muted-foreground))",
                  }}
                />
                <span className="truncate">{status.label}</span>
              </span>
              <span className="font-medium tabular-nums">{status.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRanking({
  title,
  description,
  items,
  icon: Icon,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: MektekDashboardAnalytics["topProducts"];
  icon: LucideIcon;
  emptyMessage: string;
}) {
  const maxQuantity = Math.max(...items.map((item) => item.quantity), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ol className="space-y-4">
            {items.map((item, index) => (
              <li key={item.key} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {item.quantity} terjual
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(item.revenue)}
                    </p>
                  </div>
                </div>
                <div className="ms-9 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(item.quantity / maxQuantity) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function LoyalCustomerRanking({
  customers,
}: {
  customers: MektekDashboardAnalytics["loyalCustomers"];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Pelanggan paling loyal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Berdasarkan kunjungan selesai dan nilai pembayaran
          </p>
        </div>
        <Crown className="size-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Data pelanggan belum tersedia.
          </div>
        ) : (
          <ol className="space-y-1">
            {customers.map((customer, index) => (
              <li key={customer.key}>
                <div className="flex items-center gap-3 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.completedOrders} selesai · {customer.orderCount} total pesanan
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {formatCompactCurrency(customer.amountSpent)}
                  </p>
                </div>
                {index < customers.length - 1 && <Separator />}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default function MektekDashboardInsights({
  analytics,
}: {
  analytics: MektekDashboardAnalytics;
}) {
  const { kpis } = analytics;

  return (
    <section aria-labelledby="business-insights-title" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="business-insights-title" className="text-lg font-semibold">
            Insight bisnis
          </h2>
          <p className="text-sm text-muted-foreground">
            Penjualan, pelanggan, dan performa item secara keseluruhan
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {kpis.orderCount} pesanan dianalisis
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightKpi
          label="Pendapatan diterima"
          value={formatCurrency(kpis.collectedRevenue)}
          detail={`${formatCurrency(kpis.totalOrderValue)} total nilai pesanan`}
          icon={Banknote}
        />
        <InsightKpi
          label="Rata-rata pesanan"
          value={formatCurrency(kpis.averageOrderValue)}
          detail="Nilai rata-rata per pesanan"
          icon={ReceiptText}
        />
        <InsightKpi
          label="Pelanggan unik"
          value={kpis.customerCount.toLocaleString("id-ID")}
          detail="Pelanggan pada seluruh histori"
          icon={Users}
        />
        <InsightKpi
          label="Item terjual"
          value={kpis.itemQuantity.toLocaleString("id-ID")}
          detail="Produk dan layanan tercatat"
          icon={Package}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OrderValueTrend points={analytics.orderValueTrend} />
        <StatusDistribution statuses={analytics.statusDistribution} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ItemRanking
          title="Produk terlaris"
          description="Peringkat berdasarkan jumlah unit"
          items={analytics.topProducts}
          icon={ShoppingBag}
          emptyMessage="Belum ada penjualan produk."
        />
        <ItemRanking
          title="Layanan terpopuler"
          description="Peringkat berdasarkan jumlah pekerjaan"
          items={analytics.topServices}
          icon={Wrench}
          emptyMessage="Belum ada layanan tercatat."
        />
        <LoyalCustomerRanking customers={analytics.loyalCustomers} />
      </div>
    </section>
  );
}
