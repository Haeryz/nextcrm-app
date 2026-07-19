import Link from "next/link";

import {
  listMektekVoucherCustomerOptions,
  listMektekVouchers,
} from "@/actions/mektek/vouchers";
import { listMektekVoucherCodeDictionaries } from "@/actions/mektek/voucher-code-dictionaries";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authOptions } from "@/lib/auth";
import { canManageMektekVouchers } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import VoucherManager from "./_components/VoucherManager";

interface MektekVouchersPageProps {
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

export default async function MektekVouchersPage({
  params,
  searchParams,
}: MektekVouchersPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canManageMektekVouchers(session?.user)) {
    return (
      <Container title="Voucher" description="Kelola Voucher MekTek">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Hanya Admin yang dapat mengelola Voucher.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams, "q");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const [vouchers, customers, dictionaries] = await Promise.all([
    listMektekVouchers({
      query,
      page,
      pageSize: 12,
    }),
    listMektekVoucherCustomerOptions(),
    listMektekVoucherCodeDictionaries(),
  ]);

  if ("error" in vouchers || "error" in customers || "error" in dictionaries) {
    return (
      <Container title="Voucher" description="Kelola Voucher MekTek">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {"error" in vouchers
              ? vouchers.error
              : "error" in customers
                ? customers.error
                : dictionaries.error}
          </CardContent>
        </Card>
      </Container>
    );
  }

  const { items, totalCount, totalPages } = vouchers.data;
  const previousPage = Math.max(1, vouchers.data.page - 1);
  const nextPage = Math.min(totalPages, vouchers.data.page + 1);
  const queryString = new URLSearchParams();
  if (query) queryString.set("q", query);

  const pageHref = (targetPage: number) => {
    const paramsForPage = new URLSearchParams(queryString);
    paramsForPage.set("page", String(targetPage));
    return `/${locale}/mektek/vouchers?${paramsForPage.toString()}`;
  };

  return (
    <Container
      title="Voucher"
      description="Buat discount untuk semua Customer, Customer type, atau Customer tertentu"
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/vouchers`}
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <Input
                name="q"
                placeholder="Cari Code, Title, atau Customer"
                defaultValue={query}
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Filter
              </Button>
              {query && (
                <Button asChild type="button" variant="ghost" className="w-full sm:w-auto">
                  <Link href={`/${locale}/mektek/vouchers`}>Reset Filter</Link>
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <VoucherManager
          vouchers={items.map((item) => ({
            ...item,
            startsAt: item.startsAt?.toISOString() ?? null,
            expiresAt: item.expiresAt?.toISOString() ?? null,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))}
          customers={customers.data}
          dictionaries={dictionaries.data.map((dictionary) => ({
            ...dictionary,
            createdAt: dictionary.createdAt.toISOString(),
            updatedAt: dictionary.updatedAt.toISOString(),
          }))}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {vouchers.data.page} of {totalPages} - {totalCount} vouchers
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button asChild variant="outline" size="sm" disabled={vouchers.data.page <= 1}>
              <Link href={pageHref(previousPage)}>Sebelumnya</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={vouchers.data.page >= totalPages}
            >
              <Link href={pageHref(nextPage)}>Berikutnya</Link>
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
