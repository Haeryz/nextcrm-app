import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  Clock3,
  PackageCheck,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  SupplyConflictContext,
  SupplyConflictPurchaseOrder,
} from "@/lib/mektek/supply-conflict-approval";
import { cn } from "@/lib/utils";

import FinanceApprovalDecision from "./FinanceApprovalDecision";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));

const dateTimeLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

const modeLabel = (mode: "MANUAL" | "CONSIGNMENT") =>
  mode === "CONSIGNMENT" ? "Konsinyasi" : "Manual";

function PurchaseOrderSummary({
  label,
  purchaseOrder,
  blocked = false,
}: {
  label: string;
  purchaseOrder: SupplyConflictPurchaseOrder;
  blocked?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-background p-4",
        blocked && "border-destructive/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-semibold">{purchaseOrder.poNumber}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={blocked ? "destructive" : "secondary"}>
            {blocked ? "Diblokir" : purchaseOrder.purchaseOrderStatus}
          </Badge>
          <Badge variant="outline">{modeLabel(purchaseOrder.poMode)}</Badge>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Customer / PT tujuan</dt>
          <dd className="mt-0.5 font-medium">{purchaseOrder.customerName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Proyek</dt>
          <dd className="mt-0.5 font-medium">{purchaseOrder.projectName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Periode supply
          </dt>
          <dd className="mt-0.5 font-medium">
            {dateLabel(purchaseOrder.supplyStartDate)}–{dateLabel(purchaseOrder.supplyEndDate)}
          </dd>
        </div>
      </dl>

      <Separator className="my-4" />
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <PackageCheck className="size-3.5" />
          Item yang bertumpang tindih
        </p>
        {purchaseOrder.items.map((item) => (
          <div
            key={item.allocationId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2"
          >
            <div>
              <p className="font-medium">{item.itemName}</p>
              <p className="text-xs text-muted-foreground">
                {item.partNumber || "Tanpa nomor part"}
              </p>
            </div>
            <Badge variant="outline">QTY {item.quantity}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FinanceApprovalCard({
  approvalId,
  action,
  title,
  entityLabel,
  entityId,
  status,
  statusText,
  requestedAt,
  requester,
  reason,
  conflict,
}: {
  approvalId: string;
  action: string;
  title: string;
  entityLabel: string;
  entityId: string;
  status: string;
  statusText: string;
  requestedAt: string;
  requester: string;
  reason: string | null;
  conflict: SupplyConflictContext | null;
}) {
  const pending = status === "PENDING";
  const supplyConflict = action === "OVERRIDE_SUPPLY_CONFLICT";

  return (
    <Card className={cn("overflow-hidden", pending && "border-primary/30")}>
      <CardHeader className="border-b bg-muted/30 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background">
              {supplyConflict ? (
                <AlertTriangle className="size-5 text-destructive" />
              ) : (
                <Clock3 className="size-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {entityLabel} · {entityId.slice(0, 8)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-3.5" />
                  Diajukan oleh {requester}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" />
                  {dateTimeLabel(requestedAt)} WIB
                </span>
              </div>
            </div>
          </div>
          <Badge variant={pending ? "destructive" : "outline"}>{statusText}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-5">
        {supplyConflict ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Periksa sebelum memutuskan</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customer, proyek, item, dan periode supply yang sama tercatat melalui mode Manual dan Konsinyasi. Pastikan kebutuhan tidak dipasok atau ditagihkan dua kali.
                </p>
              </div>
            </div>

            {conflict ? (
              <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <PurchaseOrderSummary
                  label="PO yang diblokir"
                  purchaseOrder={conflict.blockedPurchaseOrder}
                  blocked
                />
                <div className="hidden items-center justify-center xl:flex">
                  <div className="flex size-10 items-center justify-center rounded-full border bg-background">
                    <ArrowLeftRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-3">
                  {conflict.conflictingPurchaseOrders.map((purchaseOrder) => (
                    <PurchaseOrderSummary
                      key={purchaseOrder.purchaseOrderId}
                      label="Bertumpang tindih dengan"
                      purchaseOrder={purchaseOrder}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Detail PO lawan tidak ditemukan. Jangan menyetujui sebelum data PO diperiksa langsung di Monitoring PO.
              </div>
            )}
          </div>
        ) : null}

        {pending ? (
          <FinanceApprovalDecision
            approvalId={approvalId}
            requiresReason={supplyConflict}
            supplyConflict={supplyConflict}
          />
        ) : reason ? (
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Alasan keputusan</p>
            <p className="mt-1">{reason}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
