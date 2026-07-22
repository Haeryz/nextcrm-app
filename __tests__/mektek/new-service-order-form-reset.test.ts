import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("NewServiceOrderForm success reset", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
    ),
    "utf8",
  );

  it("remounts and refocuses a fresh form after an order is created", () => {
    expect(source).toMatch(/<form\s+key=\{formResetKey\}/);
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*\}, \[formResetKey\]\);/);
    expect(source).toMatch(/scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
    expect(source).toMatch(
      /querySelector<HTMLInputElement>\("input"\)[\s\S]*?\?\.focus\(\)/,
    );
  });

  it("collects, submits, and resets the saved vehicle identity fields", () => {
    expect(source).toMatch(/id="vehicle-plate"/);
    expect(source).toMatch(/customerType === "B2B"[\s\S]*id="vehicle-fleet-number"/);
    expect(source).toMatch(/createMektekServiceOrder\(\{[\s\S]*vehiclePlateNumber,[\s\S]*vehicleFleetNumber,/);
    expect(source).toMatch(/setVehiclePlateNumber\(""\)/);
    expect(source).toMatch(/setVehicleFleetNumber\(""\)/);
  });

  it("restricts KM mobil to a persisted whole-number input", () => {
    expect(source).toMatch(/id="vehicle-mileage"[\s\S]*type="number"/);
    expect(source).toMatch(/inputMode="numeric"/);
    expect(source).toMatch(/createMektekServiceOrder\(\{[\s\S]*vehicleMileageKm,/);
    expect(source).toMatch(/setVehicleMileageKm\(""\)/);
  });

  it("searches saved customers separately by customer name or vehicle plate", () => {
    expect(source).toMatch(
      /const \[customerSearchQuery, setCustomerSearchQuery\] = useState\(""\)/,
    );
    expect(source).toMatch(
      /placeholder="Cari nama pelanggan atau plat kendaraan"/,
    );
    expect(source).toMatch(/const query = customerSearchQuery\.trim\(\)/);
    expect(source).toMatch(/id="customer-name"[\s\S]*value=\{customerName\}/);
    expect(source).toMatch(
      /customer\.vehicles\.find\([\s\S]*normalizeMektekVehiclePlateNumber\([\s\S]*includes\(normalizedPlateQuery\)/,
    );
  });

  it("groups the three technician slots into a clear team picker", () => {
    expect(source).toMatch(/<fieldset[\s\S]*Tim Technician[\s\S]*<\/fieldset>/);
    expect(source).toMatch(/Teknisi utama/);
    expect(source).toMatch(/Pendamping 1/);
    expect(source).toMatch(/Pendamping 2/);
    expect(source).toMatch(
      /technician\.id === selectedId \|\| !unavailableIds\.includes\(technician\.id\)/,
    );
  });
});
