import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("New service order form UI", () => {
  const formSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
    ),
    "utf8",
  );
  const itemsSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/_components/DamageItemsInput.tsx",
    ),
    "utf8",
  );

  it("groups the intake flow into four clearly named sections", () => {
    expect(formSource).toContain('title="Data Pelanggan"');
    expect(formSource).toContain('title="Data Kendaraan"');
    expect(formSource).toContain('title="Penugasan & Jadwal"');
    expect(formSource).toContain('title="Pekerjaan & Estimasi"');
  });

  it("uses persistent labels for required order fields", () => {
    expect(formSource).toMatch(/htmlFor="customer-name"[\s\S]*Nama pelanggan/);
    expect(formSource).toMatch(/htmlFor="vehicle-name"[\s\S]*Kendaraan/);
    expect(formSource).toMatch(/htmlFor="vehicle-plate"[\s\S]*Nomor plat/);
    expect(formSource).toMatch(/htmlFor="estimated-done"[\s\S]*Estimasi selesai/);
  });

  it("makes every service row understandable without relying on placeholders", () => {
    expect(itemsSource).toContain("descriptionLabel");
    expect(itemsSource).toContain("Harga satuan");
    expect(itemsSource).toContain("Total baris");
    expect(itemsSource).toMatch(/type="number"[\s\S]*inputMode="numeric"/);
    expect(itemsSource).toContain("minimumItems");
  });

  it("shows a live order estimate beside the final action", () => {
    expect(formSource).toContain("Total estimasi order");
    expect(formSource).toContain("totalEstimatedCost");
    expect(formSource).toContain("Buat Order Servis");
  });
});
