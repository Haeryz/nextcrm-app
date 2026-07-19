import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InvoiceActionsProps = {
  serviceOrderId: string;
  invoiceAvailable: boolean;
  receiptAvailable: boolean;
};

export default function InvoiceActions({
  serviceOrderId,
  invoiceAvailable,
  receiptAvailable,
}: InvoiceActionsProps) {
  const invoiceHref = `/api/mektek/service-orders/${serviceOrderId}/invoice?download=1`;
  const receiptHref = `/api/mektek/service-orders/${serviceOrderId}/receipt?download=1`;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
          Invoice & Struk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invoiceAvailable ? (
          <Button asChild className="w-full">
            <a href={invoiceHref} target="_blank" rel="noreferrer">
              Download Invoice
            </a>
          </Button>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Invoice tersedia setelah servis selesai dan masuk tahap pembayaran.
          </p>
        )}

        {receiptAvailable ? (
          <Button asChild variant="outline" className="w-full">
            <a href={receiptHref} target="_blank" rel="noreferrer">
              Download Struk
            </a>
          </Button>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Struk tersedia setelah pembayaran lunas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
