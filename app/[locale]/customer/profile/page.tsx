import Link from "next/link";
import { ClipboardList, PackageSearch, Phone, UserRound } from "lucide-react";
import CustomerSignUpForm from "../_components/CustomerSignUpForm";
import LinkServiceForm from "../_components/LinkServiceForm";
import {
  getCurrentCatalogCustomer,
  getCustomerInquiries,
  getCustomerServiceProgress,
} from "@/actions/catalog/customer";
import { getStatusMeta } from "@/app/[locale]/(routes)/mektek/_lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceLabel(source: string) {
  if (source === "TOKEN_LINK") return "Linked";
  if (source === "ADMIN_ASSIGN") return "Assigned";
  return "Phone match";
}

function inquiryItems(items: unknown) {
  return Array.isArray(items) ? items : [];
}

export default async function CustomerProfilePage() {
  const customer = await getCurrentCatalogCustomer();
  if (!customer) {
    return <CustomerSignUpForm />;
  }

  const [inquiries, services] = await Promise.all([
    getCustomerInquiries(customer.id),
    getCustomerServiceProgress(customer),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Customer profile
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your catalogue inquiries and current Mektek service progress.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="size-4" />
              Customer
            </CardTitle>
            <CardDescription>Read-only customer mode profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Username</p>
              <p className="mt-1 font-semibold">{customer.username}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Phone className="size-3" />
                Phone
              </p>
              <p className="mt-1 font-semibold">{customer.phone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Link service progress</CardTitle>
            <CardDescription>
              Phone matches appear automatically. You can also paste a tracking link from admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkServiceForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Service progress</CardTitle>
              <CardDescription>Active services are shown first.</CardDescription>
            </div>
            <Badge variant="secondary">{services.length} services</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {services.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              No matching services yet. Admin can assign one, or you can link a tracking URL.
            </div>
          ) : (
            services.map((service) => {
              const statusMeta = getStatusMeta(service.status);
              return (
                <div key={service.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                        <Badge variant="outline">{sourceLabel(service.source)}</Badge>
                      </div>
                      <p className="font-semibold">{service.vehicle}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {service.id.slice(0, 8)} · ETA {formatDate(service.dueDateAt)}
                      </p>
                    </div>
                    {service.trackingHref && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={service.trackingHref}>Open tracking</Link>
                      </Button>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{service.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${statusMeta.barColor}`}
                        style={{ width: `${service.progress}%` }}
                      />
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <p className="text-sm font-medium">
                    {service.latestUpdate?.description || "No timeline update yet."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last update: {formatDate(service.latestUpdate?.createdAt)}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="size-4" />
                Inquiry history
              </CardTitle>
              <CardDescription>Submitted catalogue item requests.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/customer">
                <PackageSearch className="size-4" />
                Browse catalogue
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {inquiries.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              No inquiries submitted yet.
            </div>
          ) : (
            inquiries.map((inquiry) => (
              <div key={inquiry.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Inquiry {inquiry.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(inquiry.createdAt)}
                    </p>
                  </div>
                  <Badge variant={inquiry.status === "NEW" ? "default" : "secondary"}>
                    {inquiry.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {inquiryItems(inquiry.items).map((item: any) => (
                    <div
                      key={`${inquiry.id}-${item.itemId}`}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {item.description} · {item.catalogPartNumber || item.partNumber}
                      </span>
                      <span className="shrink-0 text-muted-foreground">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
                {inquiry.note && (
                  <p className="mt-3 text-sm text-muted-foreground">{inquiry.note}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
