import Container from "@/app/[locale]/(routes)/components/ui/Container";
import InquiryStatusSelect from "./InquiryStatusSelect";
import { getAdminCatalogInquiries } from "@/actions/catalog/admin";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDate(value: Date) {
  return value.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function itemsFromJson(items: unknown) {
  return Array.isArray(items) ? items : [];
}

function formatPrice(price: number | null | undefined) {
  if (typeof price !== "number") return "Ask for price";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default async function CatalogInquiriesAdminPage() {
  const inquiries = await getAdminCatalogInquiries();

  return (
    <Container
      title="Catalog Inquiries"
      description="Customer part requests submitted from customer mode"
    >
      <div className="flex flex-col gap-4">
        {inquiries.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No customer inquiries yet.
            </CardContent>
          </Card>
        ) : (
          inquiries.map((inquiry) => (
            <Card key={inquiry.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {inquiry.customer.username}
                    </CardTitle>
                    <CardDescription>
                      {inquiry.customer.phone} · Submitted {formatDate(inquiry.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inquiry.status === "NEW" ? "default" : "secondary"}>
                      {inquiry.status}
                    </Badge>
                    <InquiryStatusSelect
                      inquiryId={inquiry.id}
                      status={String(inquiry.status)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {itemsFromJson(inquiry.items).map((item: any) => (
                  <div
                    key={`${inquiry.id}-${item.itemId}`}
                    className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_140px_80px]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.machine} · {item.catalogPartNumber || item.partNumber || "No part number"}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatPrice(item.price)}</p>
                    <p className="text-sm text-muted-foreground">Qty {item.quantity}</p>
                  </div>
                ))}
                {inquiry.note && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    {inquiry.note}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </Container>
  );
}
