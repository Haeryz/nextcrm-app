import Container from "@/app/[locale]/(routes)/components/ui/Container";
import AssignServiceForm from "./AssignServiceForm";
import {
  getAdminCatalogCustomers,
  getAssignableMektekOrders,
} from "@/actions/catalog/admin";
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

export default async function CatalogCustomersAdminPage() {
  const [customers, services] = await Promise.all([
    getAdminCatalogCustomers(),
    getAssignableMektekOrders(),
  ]);

  return (
    <Container
      title="Catalog Customers"
      description="Lightweight customer profiles and service assignments"
    >
      <div className="flex flex-col gap-4">
        {customers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No customer profiles yet.
            </CardContent>
          </Card>
        ) : (
          customers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{customer.username}</CardTitle>
                    <CardDescription>
                      {customer.phone} · Joined {formatDate(customer.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {customer._count.inquiries} inquiries
                    </Badge>
                    <Badge variant="secondary">
                      {customer._count.serviceLinks} assigned services
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <AssignServiceForm customerId={customer.id} services={services} />
                {customer.serviceLinks.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {customer.serviceLinks.map((link) => (
                      <div key={link.id} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">
                          {link.serviceOrder?.title || link.serviceOrderId}
                        </p>
                        <p className="text-muted-foreground">
                          {String(link.source)} · {String(link.serviceOrder?.taskStatus || "-")}
                        </p>
                      </div>
                    ))}
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
