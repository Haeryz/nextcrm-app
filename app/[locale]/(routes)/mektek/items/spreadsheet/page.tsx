import Link from "next/link";

import { getMektekCatalogInventoryExportData } from "@/actions/mektek/catalog-inventory";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
            <Button asChild type="button" variant="ghost" className="w-full sm:w-auto">
              <Link href={`/${locale}/mektek/items`}>Kembali ke Catalogue Items</Link>
            </Button>
            <form
              action={`/${locale}/mektek/items/spreadsheet`}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="inventory-month"
                  className="text-sm font-medium leading-none"
                >
                  Bulan inventory
                </label>
                <Input
                  id="inventory-month"
                  type="month"
                  name="month"
                  max={currentMonth}
                  defaultValue={inventory.month}
                />
              </div>
              <Button type="submit" variant="outline">
                Tampilkan Bulan
              </Button>
            </form>
          </CardContent>
        </Card>

        <CatalogInventoryPanel
          items={inventory.snapshots.map((snapshot) => ({
            id: snapshot.id,
            description: snapshot.itemName,
            inventory: snapshot,
          }))}
          month={inventory.month}
          daysInMonth={daysInMonth}
        />
      </div>
    </Container>
  );
}
