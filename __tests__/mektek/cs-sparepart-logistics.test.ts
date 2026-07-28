import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("CS sparepart-only logistics flow", () => {
  const schema = source("prisma/schema.prisma");
  const serviceAction = source("actions/mektek/service-orders.ts");
  const serviceForm = source(
    "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
  );
  const outboundManager = source(
    "app/[locale]/(routes)/mektek/logistics/_components/OutboundLogisticsManager.tsx",
  );
  const serviceDetail = source(
    "app/[locale]/(routes)/mektek/[id]/page.tsx",
  );

  it("stores an explicit one-to-one link between a CS order and logistics PO", () => {
    expect(schema).toContain("sourceServiceOrderId");
    expect(schema).toContain("logisticsPurchaseOrder");
    expect(serviceAction).toContain("sourceServiceOrderId: serviceOrder.id");
  });

  it("allows a sparepart-only order while still rejecting an empty order", () => {
    expect(serviceAction).toContain(
      "serviceItems.length === 0 && sparepartItems.length === 0",
    );
    expect(serviceForm).toMatch(
      /describedServiceItems\.length === 0\s*&&\s*describedSparepartItems\.length === 0/,
    );
    expect(serviceForm).toContain("Pekerjaan Servis (opsional)");
    expect(serviceForm).toContain("minimumItems={0}");
  });

  it("starts sparepart-only orders at awaiting payment without skipping service work", () => {
    expect(serviceAction).toMatch(
      /taskStatus:\s*serviceItems\.length === 0 \? "AWAITING_PAYMENT" : "ACTIVE"/,
    );
    expect(serviceAction).toMatch(
      /serviceItems\.length === 0\s*\? SPAREPART_ONLY_TIMELINE_MESSAGE/,
    );
    expect(serviceAction).toMatch(
      /if \(serviceItems\.length === 0\)[\s\S]*syncServiceOrderBillingSource\(tx/,
    );
  });

  it("marks CS-origin logistics rows in orange", () => {
    expect(outboundManager).toContain("sourceServiceOrderId");
    expect(outboundManager).toContain("bg-orange-300/70 hover:bg-orange-400/70");
    expect(outboundManager).toContain("bg-orange-500 text-white");
    expect(outboundManager).toContain("Pesanan CS");
  });

  it("exposes linked delivery notes in the CS order detail", () => {
    expect(serviceDetail).toContain("Surat Jalan Pesanan");
    expect(serviceDetail).toContain("/delivery-notes/");
  });

  it("uses a public customer number instead of exposing a UUID", () => {
    expect(schema).toContain("customerNumber");
    expect(serviceDetail).toContain("catalogCustomerNumber");
  });
});
