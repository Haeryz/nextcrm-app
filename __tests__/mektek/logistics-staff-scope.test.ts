import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Logistics sub-admin scope contract", () => {
  const schema = source("prisma/schema.prisma");
  const staffFields = source(
    "app/[locale]/(routes)/mektek/staff/_components/StaffDivisionFields.tsx",
  );
  const logisticsActions = source("actions/mektek/logistics.ts");
  const monitoringPage = source(
    "app/[locale]/(routes)/mektek/logistics/page.tsx",
  );
  const receivingPage = source(
    "app/[locale]/(routes)/mektek/receiving/page.tsx",
  );
  const deliveryNoteRoute = source(
    "app/api/mektek/logistics/purchase-orders/[id]/delivery-note/route.ts",
  );
  const receivingPdfRoute = source(
    "app/api/mektek/logistics/purchase-orders/[id]/pdf/route.ts",
  );
  const catalogPage = source("app/[locale]/(routes)/mektek/items/page.tsx");

  it("persists a dedicated Logistics area and shows its conditional selector", () => {
    expect(schema).toContain("enum LogisticsStaffArea");
    expect(schema).toContain("logisticsStaffArea LogisticsStaffArea?");
    expect(staffFields).toContain('division === "LOGISTICS"');
    expect(staffFields).toContain('name="logisticsStaffArea"');
  });

  it("enforces Monitoring PO and Receiving independently at server boundaries", () => {
    expect(logisticsActions).toContain(
      'ensureLogisticsManager("MONITORING_PO")',
    );
    expect(logisticsActions).toContain('ensureLogisticsManager("RECEIVING")');
    expect(monitoringPage).toContain(
      'canManageMektekLogistics(session?.user, "MONITORING_PO")',
    );
    expect(receivingPage).toContain(
      'canManageMektekLogistics(session?.user, "RECEIVING")',
    );
    expect(deliveryNoteRoute).toContain(
      'requireMektekLogisticsApiSession("MONITORING_PO", request)',
    );
    expect(receivingPdfRoute).toContain(
      'requireMektekLogisticsApiSession("RECEIVING", request)',
    );
  });

  it("keeps Catalog available through its own general Logistics capability", () => {
    expect(catalogPage).toContain("canManageMektekCatalog");
  });
});
