import React from "react";
import Link from "next/link";
import { ArrowRight, PackageOpen, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CatalogImage } from "@/components/mektek/CatalogImage";
import { getExistingCatalogImagePath } from "@/lib/catalog-images";
import type { CatalogInsightItem } from "@/lib/mektek/catalog-insights";

type PopularItem = CatalogInsightItem & { soldQuantity: number };

const formatPrice = (price: number | null) =>
  typeof price === "number"
    ? price.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    : "Harga segera hadir";

function HighlightGroup({
  title,
  description,
  items,
  icon: Icon,
  popular,
  locale,
}: {
  title: string;
  description: string;
  items: Array<CatalogInsightItem | PopularItem>;
  icon: LucideIcon;
  popular?: boolean;
  locale: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[#fff200] p-2 text-[#10164f]"><Icon className="size-4" /></span>
        <div>
          <h2 className="font-semibold text-[#10164f]">{title}</h2>
          <p className="text-sm text-[#4b5577]">{description}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const query = item.partNumber || item.description;
          return (
            <Link key={item.id} href={`/${locale}/customer?view=sparepart&q=${encodeURIComponent(query)}`}>
              <Card className="h-full overflow-hidden border-[#151a63]/10 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="aspect-[16/9] bg-[#eef1ff]">
                  <CatalogImage
                    src={getExistingCatalogImagePath(item.imagePath)}
                    alt={item.description}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  />
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="max-w-[65%] truncate bg-[#eef1ff] text-[#151a63] hover:bg-[#eef1ff]">{item.machine}</Badge>
                    <Badge className="bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
                      {popular && "soldQuantity" in item ? `${item.soldQuantity} terjual` : "Baru"}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold">{item.description}</p>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#4b5577]">
                    <span>{formatPrice(item.price)}</span><ArrowRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerCatalogHighlights({ locale, popular, newest }: { locale: string; popular: PopularItem[]; newest: CatalogInsightItem[] }) {
  if (popular.length === 0 && newest.length === 0) return null;
  return (
    <section aria-label="Sorotan katalog" className="space-y-6 rounded-xl border border-[#151a63]/10 bg-[#eef1ff]/55 p-4 md:p-5">
      <HighlightGroup title="Paling banyak dibeli" description="Pilihan pelanggan berdasarkan transaksi MekTek" items={popular} icon={TrendingUp} popular locale={locale} />
      <HighlightGroup title="Baru di katalog" description="Sparepart yang paling baru ditambahkan" items={newest} icon={popular.length ? Sparkles : PackageOpen} locale={locale} />
    </section>
  );
}
