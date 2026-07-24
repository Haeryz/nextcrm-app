import { normalizeMektekTechnicianSelections } from "@/lib/mektek/technicians";

describe("normalizeMektekTechnicianSelections", () => {
  it("accepts registered and manually typed technicians in slot order", () => {
    expect(
      normalizeMektekTechnicianSelections([
        { id: "tech-1", name: "Winarto" },
        { name: "Teknisi Tamu" },
      ]),
    ).toEqual([
      { id: "tech-1", name: "Winarto" },
      { id: null, name: "Teknisi Tamu" },
    ]);
  });

  it("rejects duplicate manual names case-insensitively", () => {
    expect(() =>
      normalizeMektekTechnicianSelections([
        { name: "Teknisi Tamu" },
        { name: "teknisi tamu" },
      ]),
    ).toThrow("Setiap technician harus berbeda.");
  });

  it("requires a primary technician and limits the team to three", () => {
    expect(() => normalizeMektekTechnicianSelections([])).toThrow(
      "Pilih minimal 1 technician.",
    );
    expect(() =>
      normalizeMektekTechnicianSelections([
        { name: "Satu" },
        { name: "Dua" },
        { name: "Tiga" },
        { name: "Empat" },
      ]),
    ).toThrow("Pilih maksimal 3 technician.");
  });
});
