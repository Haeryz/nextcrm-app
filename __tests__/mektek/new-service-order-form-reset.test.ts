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
    expect(source).toMatch(/placeholder="Nomor plat kendaraan"/);
    expect(source).toMatch(/customerType === "B2B"[\s\S]*placeholder="Nomor lambung"/);
    expect(source).toMatch(/createMektekServiceOrder\(\{[\s\S]*vehiclePlateNumber,[\s\S]*vehicleFleetNumber,/);
    expect(source).toMatch(/setVehiclePlateNumber\(""\)/);
    expect(source).toMatch(/setVehicleFleetNumber\(""\)/);
  });

  it("restricts KM mobil to a persisted whole-number input", () => {
    expect(source).toMatch(/placeholder="KM mobil"[\s\S]*type="number"/);
    expect(source).toMatch(/inputMode="numeric"/);
    expect(source).toMatch(/createMektekServiceOrder\(\{[\s\S]*vehicleMileageKm,/);
    expect(source).toMatch(/setVehicleMileageKm\(""\)/);
  });
});
