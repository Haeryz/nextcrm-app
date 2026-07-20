import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MektekDashboardInsights from "@/app/[locale]/(routes)/mektek/dashboard/_components/MektekDashboardInsights";
import { buildMektekDashboardAnalytics } from "@/lib/mektek/dashboard-analytics";

describe("MektekDashboardInsights", () => {
  it("server-renders accessible visualizations and designed empty states", () => {
    const analytics = buildMektekDashboardAnalytics(
      [],
      new Date("2026-07-20T12:00:00.000Z"),
    );
    const markup = renderToStaticMarkup(
      <MektekDashboardInsights
        analytics={analytics}
        itemActivity={{
          newestItems: [{
            id: "new-filter",
            machine: "PC200",
            description: "Filter baru",
            partNumber: "FB-1",
            quantity: "7",
            createdAt: new Date("2026-07-20T08:00:00.000Z"),
          }],
          quantityUpdates: [{
            id: "stock-filter",
            machine: "PC300",
            description: "Filter stok",
            partNumber: "FS-2",
            quantity: "9",
            previousQuantity: "2",
            quantityUpdatedAt: new Date("2026-07-20T09:00:00.000Z"),
          }],
        }}
      />,
    );

    expect(markup).toContain("Insight bisnis");
    expect(markup).toContain("Tren nilai pesanan");
    expect(markup).toContain("Distribusi status");
    expect(markup).toContain("Produk terlaris");
    expect(markup).toContain("Pelanggan paling loyal");
    expect(markup.match(/role="img"/g)).toHaveLength(2);
    expect(markup).toContain(
      'aria-label="Grafik nilai pesanan MekTek selama enam bulan terakhir"',
    );
    expect(markup).toContain("Belum ada penjualan produk.");
    expect(markup).toContain("Belum ada nilai pesanan untuk periode ini");
    expect(markup).toContain("Data pelanggan belum tersedia.");
    expect(markup).toContain("Item terbaru ditambahkan");
    expect(markup).toContain("Filter baru");
    expect(markup).toContain("Pembaruan quantity");
    expect(markup).toContain("2 → 9");
  });
});
