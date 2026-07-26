import React from "react";
import Link from "next/link";
import { ArrowRight, PackageOpen, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CatalogImage } from "@/components/mektek/CatalogImage";
import { getExistingCatalogImagePath } from "@/lib/catalog-images";
import type { CatalogInsightItem } from "@/lib/mektek/catalog-insights";

type PopularItem = CatalogInsightItem & { soldQuantity: number };

/*
 * Colours come from the `.customer-light` brand scope in `app/[locale]/globals.css`.
 * Keep this file hex-free so the storefront palette stays changeable in one place,
 * and keep the card anatomy in step with the main grid in `../page.tsx`:
 * machine badge + signal badge, then title, then price as the largest line.
 */
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
  const headingId = `sorotan-${popular ? "populer" : "terbaru"}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))]">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold text-[hsl(var(--brand-navy-deep))]">
            {title}
          </h2>
          <p className="text-sm text-[hsl(var(--brand-muted))]">{description}</p>
        </div>
      </div>
      <ul role="list" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const query = item.partNumber || item.description;
          const hasPrice = typeof item.price === "number";

          return (
            <li key={item.id} className="min-w-0">
              <Link
                href={`/${locale}/customer?view=sparepart&q=${encodeURIComponent(query)}`}
                className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden rounded-xl border-primary/10 bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-[16/9] bg-[hsl(var(--brand-surface-alt))]">
                    <CatalogImage
                      src={getExistingCatalogImagePath(item.imagePath)}
                      alt={`Foto sparepart ${item.description} untuk mesin ${item.machine}`}
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="min-w-0 max-w-[65%] truncate">
                        <span className="sr-only">Mesin: </span>
                        {item.machine}
                      </Badge>
                      <Badge className="shrink-0 border-transparent bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))] hover:bg-[hsl(var(--brand-yellow))]">
                        {popular && "soldQuantity" in item ? `${item.soldQuantity} terjual` : "Baru"}
                      </Badge>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[hsl(var(--brand-navy-ink))]">
                      {item.description}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={
                          hasPrice
                            ? "text-base font-bold tabular-nums tracking-tight text-[hsl(var(--brand-navy-deep))]"
                            : "text-xs font-semibold text-[hsl(var(--brand-muted))]"
                        }
                      >
                        <span className="sr-only">Harga: </span>
                        {formatPrice(item.price)}
                      </p>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[hsl(var(--brand-muted))]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function CustomerCatalogHighlights({ locale, popular, newest }: { locale: string; popular: PopularItem[]; newest: CatalogInsightItem[] }) {
  if (popular.length === 0 && newest.length === 0) return null;
  return (
    <section
      aria-label="Sorotan katalog"
      className="space-y-6 rounded-xl border border-primary/10 bg-[hsl(var(--brand-surface-alt))]/55 p-5"
    >
      <HighlightGroup title="Paling banyak dibeli" description="Pilihan pelanggan berdasarkan transaksi MekTek" items={popular} icon={TrendingUp} popular locale={locale} />
      <HighlightGroup title="Baru di katalog" description="Sparepart yang paling baru ditambahkan" items={newest} icon={popular.length ? Sparkles : PackageOpen} locale={locale} />
    </section>
  );
}
