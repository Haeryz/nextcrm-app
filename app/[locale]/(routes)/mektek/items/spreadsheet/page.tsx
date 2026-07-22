import Link from "next/link";

import { getMektekCatalogInventoryExportData } from "@/actions/mektek/catalog-inventory";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import {
  getCatalogInventoryMonthKey,
  getCatalogInventoryMonthRange,
} from "@/lib/mektek/catalog-inventory";
import { canCreateMektekOrders } from "@/lib/mektek/permissions";
import { getServerSession } from "@/lib/session";
import CatalogInventoryPanel from "../_components/CatalogInventoryPanel";

interface MektekCatalogInventorySpreadsheetPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MektekCatalogInventorySpreadsheetPage({
  params,
  searchParams,
}: MektekCatalogInventorySpreadsheetPageProps) {
  const { locale = "id" } = params ? await params : { locale: "id" };
  const session = await getServerSession(authOptions);

  if (!canCreateMektekOrders(session?.user)) {
    return (
      <Container
        title="Spreadsheet Inventory"
        description="Lihat dan filter seluruh stok sparepart MekTek"
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Hanya Admin atau CS MekTek yang dapat melihat Spreadsheet Inventory.
          </CardContent>
        </Card>
      </Container>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentMonth = getCatalogInventoryMonthKey();
  const requestedMonth = readSearchParam(resolvedSearchParams, "month") || currentMonth;
  const inventory = await getMektekCatalogInventoryExportData(requestedMonth);
  const { daysInMonth } = getCatalogInventoryMonthRange(inventory.month);

  return (
    <Container
      title="Spreadsheet Inventory"
      description="Seluruh barang dalam satu tabel dengan pencarian dan filter quantity"
    >
      <div className="flex flex-col gap-6">
        <div>
          <Button asChild type="button" variant="outline">
            <Link href={`/${locale}/mektek/items`}>Kembali ke Catalog / Item</Link>
          </Button>
        </div>

        <CatalogInventoryPanel
          items={inventory.snapshots.map((snapshot) => ({
            id: snapshot.id,
            description: snapshot.itemName,
            inventory: snapshot,
          }))}
          month={inventory.month}
          daysInMonth={daysInMonth}
          locale={locale}
          currentMonth={currentMonth}
        />
      </div>
    </Container>
  );
}
