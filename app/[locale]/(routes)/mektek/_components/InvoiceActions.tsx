import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InvoiceActionsProps = {
  serviceOrderId: string;
};

export default function InvoiceActions({ serviceOrderId }: InvoiceActionsProps) {
  const invoiceHref = `/api/mektek/service-orders/${serviceOrderId}/invoice?download=1`;
  const receiptHref = `/api/mektek/service-orders/${serviceOrderId}/receipt?download=1`;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
          Invoice & Struk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full">
          <a href={invoiceHref} target="_blank" rel="noreferrer">
            Download Invoice
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <a href={receiptHref} target="_blank" rel="noreferrer">
            Download Struk
          </a>
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Template PDF masih dasar dan dapat diganti nanti.
        </p>
      </CardContent>
    </Card>
  );
}
