import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Service order items editor UI", () => {
  const editorSource = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/[id]/_components/ServiceOrderItemsEditor.tsx",
    ),
    "utf8",
  );

  it("waits for the add-description action before showing a service row", () => {
    expect(editorSource).toContain(
      "const [serviceItems, setServiceItems] = useState<DamageItem[]>([])",
    );
    expect(editorSource).toContain('addLabel="Tambah deskripsi servis"');
    expect(editorSource).toMatch(
      /label="Deskripsi Servis Tambahan"[\s\S]*minimumItems=\{0\}/,
    );
  });

  it("returns to the empty service state after items are submitted", () => {
    expect(editorSource).toContain("setServiceItems([])");
  });

  it("offers a ready-to-send Timeline template after item changes", () => {
    expect(editorSource).toContain("result.data.timelineDraft");
    expect(editorSource).toContain("Template update Timeline siap");
    expect(editorSource).toContain("addMektekTimelineEntry");
    expect(editorSource).toContain("Kirim update ke Timeline");
  });

  it("labels sparepart rows as Sparepart instead of Pekerjaan", () => {
    expect(editorSource).toMatch(
      /items=\{sparepartItems\}[\s\S]*itemLabel="Sparepart"/,
    );
    expect(editorSource).toMatch(
      /items=\{sparepartItems\}[\s\S]*minimumItems=\{0\}/,
    );
  });
});
