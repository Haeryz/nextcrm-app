import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("multiple customer vehicles", () => {
  it("stores vehicles as customer-owned records and upserts them during intake", () => {
    const schema = read("prisma/schema.prisma");
    const actions = read("actions/mektek/service-orders.ts");
    const migration = read(
      "prisma/migrations/20260720200000_catalog_customer_multiple_vehicles/migration.sql",
    );

    expect(schema).toContain("model CatalogCustomerVehicle");
    expect(schema).toContain("vehicles     CatalogCustomerVehicle[]");
    expect(actions).toContain("catalogCustomerVehicle.upsert");
    expect(actions).toContain("vehicles:");
    expect(migration).toContain("historical_vehicles");
    expect(migration).toContain("vehiclePlateNumber");
    expect(migration).toContain('FROM "CatalogServiceLink"');
  });

  it("offers stored plates during service creation and renders all vehicles in customer detail", () => {
    const form = read(
      "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
    );
    const detail = read(
      "app/[locale]/(routes)/mektek/customers/[id]/page.tsx",
    );

    expect(form).toContain("Pilih kendaraan / nomor plat");
    expect(form).toContain("Gunakan kendaraan baru");
    expect(form).toContain("customer.vehicles");
    expect(detail).toContain("Kendaraan Customer");
    expect(detail).toContain("customer.vehicles");
  });

  it("renders recorded vehicle mileage in customer detail cards and service history", () => {
    const detail = read(
      "app/[locale]/(routes)/mektek/customers/[id]/page.tsx",
    );

    expect(detail).toContain("tags.vehicleMileageKm");
    expect(detail).toContain("KM terakhir:");
    expect(detail).toContain('vehicleMileageKm.toLocaleString("id-ID")');
  });
});
