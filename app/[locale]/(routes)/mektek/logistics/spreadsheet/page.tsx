import Link from "next/link";

import { listMektekOutboundPurchaseOrders } from "@/actions/mektek/logistics";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authOptions } from "@/lib/auth";
import { canManageMektekLogistics } from "@/lib/mektek/permissions";
import { getPaginationItems } from "@/lib/pagination";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import OutboundLogisticsManager from "../_components/OutboundLogisticsManager";

interface SpreadsheetPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MektekLogisticsSpreadsheetPage({
  params,
  searchParams,
}: SpreadsheetPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);
  if (!canManageMektekLogistics(session?.user, "MONITORING_PO")) {
    return (
      <Container title="Spreadsheet Monitoring PO" description="Data pengiriman MekTek">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Anda tidak memiliki akses untuk mengelola Logistics.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolved = searchParams ? await searchParams : {};
  const query = param(resolved, "q");
  const rawStatus = param(resolved, "status").toUpperCase();
  const status = rawStatus === "OPEN" || rawStatus === "CLOSED" ? rawStatus : "";
  const page = Math.max(Number(param(resolved, "page")) || 1, 1);
  const [result, catalogItems, pics] = await Promise.all([
    listMektekOutboundPurchaseOrders({ query, status, page, pageSize: 20 }),
    prismadb.catalogItem.findMany({
      orderBy: [{ description: "asc" }, { partNumber: "asc" }],
      select: {
        id: true,
        description: true,
        partNumber: true,
        catalogPartNumber: true,
        rearStock: true,
        frontStock: true,
      },
    }),
    prismadb.logisticsPic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if ("error" in result) {
    return (
      <Container title="Spreadsheet Monitoring PO" description="Data pengiriman MekTek">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{result.error}</CardContent></Card>
      </Container>
    );
  }

  const baseParams = new URLSearchParams();
  if (query) baseParams.set("q", query);
  if (status) baseParams.set("status", status);
  const pageHref = (targetPage: number) => {
    const next = new URLSearchParams(baseParams);
    next.set("page", String(targetPage));
    return `/${locale}/mektek/logistics/spreadsheet?${next.toString()}`;
  };
  const paginationItems = getPaginationItems(result.data.page, result.data.totalPages);
  const purchaseOrders = result.data.items.map(
    ({ inputDate, dueDate, deliveryDate, createdAt, updatedAt, items, ...order }) => ({
      ...order,
      inputDate: inputDate.toISOString(),
      dueDate: dueDate.toISOString(),
      deliveryDate: deliveryDate?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      items: items.map(
        ({
          createdAt,
          updatedAt,
          receipts,
          agreedUnitPrice: _agreedUnitPrice,
          ...item
        }) => ({
          ...item,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          receipts: receipts.map(({ receivedAt, createdAt, ...receipt }) => ({
            ...receipt,
            receivedAt: receivedAt.toISOString(),
            createdAt: createdAt.toISOString(),
          })),
        }),
      ),
    }),
  );

  return (
    <Container
      title="Spreadsheet Monitoring PO"
      description="Filter, audit, dan export PO pengiriman berdasarkan bulan"
    >
      <div className="flex flex-col gap-6">
        <div><Button asChild variant="outline"><Link href={`/${locale}/mektek/logistics`}>Kembali ke Monitoring PO</Link></Button></div>
        <Card>
          <CardContent className="p-4">
            <form
              action={`/${locale}/mektek/logistics/spreadsheet`}
              className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto_auto]"
            >
              <Input name="q" type="search" defaultValue={query} placeholder="Cari PO, Surat Jalan, User, project, atau item" aria-label="Cari Monitoring PO" />
              <Select name="status" defaultValue={status || "ALL"}>
                <SelectTrigger aria-label="Filter status Monitoring PO"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline">Filter</Button>
              {(query || status) && <Button asChild type="button" variant="ghost"><Link href={`/${locale}/mektek/logistics/spreadsheet`}>Reset Filter</Link></Button>}
            </form>
          </CardContent>
        </Card>
        <OutboundLogisticsManager
          pics={pics}
          purchaseOrders={purchaseOrders}
          catalogItems={catalogItems.map(({ catalogPartNumber, ...item }) => ({
            ...item,
            partNumber: item.partNumber || catalogPartNumber,
          }))}
          stats={result.data.stats}
          mode="spreadsheet"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Page {result.data.page} of {result.data.totalPages} · {result.data.totalCount} PO</p>
          <nav aria-label="Halaman Spreadsheet Monitoring PO" className="flex flex-wrap gap-2">
            {result.data.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageHref(result.data.page - 1)}>Sebelumnya</Link></Button> : <Button variant="outline" size="sm" disabled>Sebelumnya</Button>}
            {paginationItems.map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">…</span> : <Button key={item} asChild size="icon" variant={item === result.data.page ? "default" : "outline"}><Link href={pageHref(item)}>{item}</Link></Button>)}
            {result.data.page < result.data.totalPages ? <Button asChild variant="outline" size="sm"><Link href={pageHref(result.data.page + 1)}>Berikutnya</Link></Button> : <Button variant="outline" size="sm" disabled>Berikutnya</Button>}
          </nav>
        </div>
      </div>
    </Container>
  );
}
