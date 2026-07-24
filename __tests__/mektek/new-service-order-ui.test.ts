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

  it("keeps customer intake limited to the original customer fields", () => {
    expect(formSource).toContain("Nama pelanggan");
    expect(formSource).toContain("Nomor telepon");
    expect(formSource).toContain("Jenis pelanggan");
    expect(formSource).toContain("Alamat");
    expect(formSource).not.toContain("Nama PIC / utusan");
    expect(formSource).not.toContain('htmlFor="company-name"');
    expect(formSource).toContain("setCustomerType(customer.customerType)");
    expect(formSource).toMatch(/htmlFor="vehicle-mileage"[\s\S]*\(opsional\)/);
    expect(formSource).toMatch(/htmlFor="vehicle-fleet-number"[\s\S]*\(opsional\)/);
  });

  it("makes customer lookup and manual sparepart entry explicit", () => {
    expect(formSource).toContain("Pilih pelanggan lama");
    expect(itemsSource).toContain("Gunakan nama manual ini");
  });

  it("lets staff type to search technicians", () => {
    expect(formSource).toContain('role="combobox"');
    expect(formSource).toContain("Ketik nama teknisi");
  });

  it("preserves manually typed technicians while still offering registered options", () => {
    expect(formSource).toContain("<datalist");
    expect(formSource).toContain(
      '<option key={technician.id} value={technician.name} />',
    );
    expect(formSource).toContain("technicianAssignments:");
    expect(formSource).toContain("name: selection.name.trim()");
    expect(formSource).not.toMatch(
      /<TechnicianSearchInput[\s\S]*<Select\s+value=\{technicianIds\[slot\]\}/,
    );
  });

  it("exposes quantity steppers and merges repeated item rows", () => {
    expect(itemsSource).toContain("mergeMektekLineItemInputs");
    expect(itemsSource).toContain("Tambah jumlah");
    expect(itemsSource).toContain("Kurangi jumlah");
  });
});
