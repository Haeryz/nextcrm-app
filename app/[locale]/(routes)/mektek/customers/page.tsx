import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";

import { listMektekCustomerUsers } from "@/actions/mektek/customers";
import { authOptions } from "@/lib/auth";
import { canManageMektekCustomers } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import CustomerUserManager from "./_components/CustomerUserManager";

interface MektekCustomersPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MektekCustomersPage({
  params,
  searchParams,
}: MektekCustomersPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekCustomers(session?.user)) {
    return (
      <Container title="Customers" description="Kelola Customer dan User Account">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Hanya Admin yang dapat mengelola Customer User Account.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const customers = await listMektekCustomerUsers({
    query,
    page,
    pageSize: 12,
  });

  if ("error" in customers) {
    return (
      <Container title="Customers" description="Kelola Customer dan User Account">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {customers.error}
          </CardContent>
        </Card>
      </Container>
    );
  }

  const { items, totalCount, totalPages } = customers.data;
  const previousPage = Math.max(1, customers.data.page - 1);
  const nextPage = Math.min(totalPages, customers.data.page + 1);
  const queryString = new URLSearchParams();
  if (query) queryString.set("q", query);

  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/customers?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Customers"
      description="Buat, perbarui, dan hapus Customer Profile beserta User Account yang terhubung"
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/customers`}
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <Input
                name="q"
                placeholder="Cari nama, nomor telepon, atau Email"
                defaultValue={query}
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Filter
              </Button>
              {query && (
                <Button asChild type="button" variant="ghost" className="w-full sm:w-auto">
                  <Link href={`/${locale}/mektek/customers`}>Reset Filter</Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <CustomerUserManager
          locale={locale}
          customers={items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            whatsappOptedOutAt: item.whatsappOptedOutAt?.toISOString() ?? null,
            user: item.user
              ? {
                  ...item.user,
                  lastLoginAt: item.user.lastLoginAt?.toISOString() ?? null,
                }
              : null,
          }))}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {customers.data.page} of {totalPages} - {totalCount} customers
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button asChild variant="outline" size="sm" disabled={customers.data.page <= 1}>
              <Link href={pageHref(previousPage)}>Sebelumnya</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={customers.data.page >= totalPages}
            >
              <Link href={pageHref(nextPage)}>Berikutnya</Link>
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
