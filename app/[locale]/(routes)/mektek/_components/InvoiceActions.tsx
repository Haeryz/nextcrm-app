import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Lock } from "lucide-react";

type InvoiceActionsProps = {
  serviceOrderId: string;
  invoiceAvailable: boolean;
  receiptAvailable: boolean;
};

const INVOICE_UNAVAILABLE_REASON =
  "Belum tersedia. Invoice bisa diunduh setelah servis selesai dan pesanan masuk tahap pembayaran.";
const RECEIPT_UNAVAILABLE_REASON =
  "Belum tersedia. Struk bisa diunduh setelah pembayaran lunas.";

function DocumentAction({
  available,
  href,
  label,
  reason,
  reasonId,
  variant = "default",
}: {
  available: boolean;
  href: string;
  label: string;
  reason: string;
  reasonId: string;
  variant?: "default" | "outline";
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      {available ? (
        <Button asChild variant={variant} className="h-10 w-full min-w-0">
          <a href={href} target="_blank" rel="noreferrer">
            <Download className="mr-2 size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full min-w-0"
          disabled
          aria-describedby={reasonId}
          title={reason}
        >
          <Lock className="mr-2 size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Button>
      )}
      {!available && (
        <p
          id={reasonId}
          className="rounded-md border border-dashed px-3 py-2 text-xs leading-snug text-muted-foreground"
        >
          {reason}
        </p>
      )}
    </div>
  );
}

export default function InvoiceActions({
  serviceOrderId,
  invoiceAvailable,
  receiptAvailable,
}: InvoiceActionsProps) {
  const invoiceHref = `/api/mektek/service-orders/${serviceOrderId}/invoice?download=1`;
  const receiptHref = `/api/mektek/service-orders/${serviceOrderId}/receipt?download=1`;

  return (
    <Card className="@container min-w-0 border shadow-sm">
      <CardHeader className="px-4 pb-3 pt-4 @min-[28rem]:px-6 @min-[28rem]:pt-6">
        <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
          Invoice & Struk
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4 @min-[28rem]:px-6 @min-[28rem]:pb-6">
        <DocumentAction
          available={invoiceAvailable}
          href={invoiceHref}
          label="Unduh Invoice"
          reason={INVOICE_UNAVAILABLE_REASON}
          reasonId="mektek-invoice-unavailable"
        />
        <DocumentAction
          available={receiptAvailable}
          href={receiptHref}
          label="Unduh Struk"
          reason={RECEIPT_UNAVAILABLE_REASON}
          reasonId="mektek-receipt-unavailable"
          variant="outline"
        />
      </CardContent>
    </Card>
  );
}
