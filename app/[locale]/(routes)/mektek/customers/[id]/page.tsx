import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, Wrench } from "lucide-react";
import { notFound } from "next/navigation";

import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { authOptions } from "@/lib/auth";
import { summarizeCustomerServiceHistory } from "@/lib/mektek/customer-history";
import { canManageMektekCustomers } from "@/lib/mektek/permissions";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusMeta } from "../../_lib/constants";

interface CustomerDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(value);
}

function readTags(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id, locale } = await params;
  const session = await getServerSession(authOptions);

  if (!canManageMektekCustomers(session?.user)) {
    return (
      <Container title="Customer Details" description="Workspace MekTek terbatas">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Hanya Admin yang dapat melihat detail Customer Account dan riwayat servis.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const customer = await prismadb.catalogCustomer.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      phone: true,
      phoneNormalized: true,
      customerType: true,
      vehicleName: true,
      vehiclePlateNumber: true,
      vehicleFleetNumber: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
        },
      },
      serviceLinks: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          serviceOrder: {
            select: {
              id: true,
              title: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              dueDateAt: true,
              taskStatus: true,
              tags: true,
              assigned_user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!customer) notFound();

  const displayName = customer.user?.name || customer.username;
  const orders = customer.serviceLinks.map((link) => link.serviceOrder);
  const summary = summarizeCustomerServiceHistory(
    orders.map((order) => order.taskStatus),
  );

  return (
    <Container
      title={displayName}
      description="Customer Profile, total servis, dan riwayat service order lengkap"
    >
      <div className="flex flex-col gap-6">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/mektek/customers`}>
              <ArrowLeft data-icon="inline-start" />
              Kembali ke Customers
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Nama</p>
              <p className="mt-1 font-medium">{displayName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nomor telepon</p>
              <p className="mt-1 font-medium">{customer.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-1 break-all font-medium">
                {customer.user?.email ?? "Belum ada Login Account"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer type</p>
              <p className="mt-1 font-medium">
                {customer.customerType === "B2B" ? "Perusahaan" : "Standard"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kendaraan</p>
              <p className="mt-1 font-medium">{customer.vehicleName ?? "Belum tersimpan"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nomor plat</p>
              <p className="mt-1 font-medium">
                {customer.vehiclePlateNumber ?? "Belum tersimpan"}
              </p>
            </div>
            {customer.customerType === "B2B" && (
              <div>
                <p className="text-xs text-muted-foreground">Nomor lambung</p>
                <p className="mt-1 font-medium">
                  {customer.vehicleFleetNumber ?? "Belum tersimpan"}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Customer sejak</p>
              <p className="mt-1 font-medium">{formatDateTime(customer.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Login terakhir</p>
              <p className="mt-1 font-medium">
                {formatDateTime(customer.user?.lastLoginAt)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Customer ID</p>
              <p className="mt-1 break-all font-mono text-sm font-medium">
                {customer.id}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Wrench className="size-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total servis</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <div>
                <p className="text-2xl font-semibold">{summary.completed}</p>
                <p className="text-xs text-muted-foreground">Servis selesai</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Clock3 className="size-5 text-amber-600" />
              <div>
                <p className="text-2xl font-semibold">{summary.open}</p>
                <p className="text-xs text-muted-foreground">Servis aktif</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat servis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customer.serviceLinks.length > 0 ? (
              <div className="divide-y">
                {customer.serviceLinks.map(({ serviceOrder: order, createdAt }) => {
                  const tags = readTags(order.tags);
                  const vehicle =
                    typeof tags.vehicle === "string" && tags.vehicle.trim()
                      ? tags.vehicle
                      : order.title;
                  const status = getStatusMeta(order.taskStatus ?? "ACTIVE");
                  const technicianTag =
                    tags.technician &&
                    typeof tags.technician === "object" &&
                    !Array.isArray(tags.technician)
                      ? (tags.technician as Record<string, unknown>)
                      : {};
                  const technician =
                    (typeof tags.technicians === "string" ? tags.technicians : "") ||
                    order.assigned_user?.name ||
                    order.assigned_user?.email ||
                    (typeof technicianTag.name === "string" ? technicianTag.name : "") ||
                    "Belum ditugaskan";

                  return (
                    <Link
                      key={order.id}
                      href={`/${locale}/mektek/${order.id}`}
                      className="group grid gap-3 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.7fr)_minmax(160px,0.8fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:underline">
                          {vehicle}
                        </p>
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {order.content || "Belum ada catatan servis"}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {order.id}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dibuat</p>
                        <p className="text-sm">
                          {formatDateTime(order.createdAt ?? createdAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estimasi / teknisi</p>
                        <p className="text-sm">{formatDateTime(order.dueDateAt)}</p>
                        <p className="truncate text-xs text-muted-foreground">{technician}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <Badge variant={status.badgeVariant}>{status.label}</Badge>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                This customer has no service history yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
