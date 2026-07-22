import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDiscountTier, discountTiers } from "../_lib/constants";

interface VisitDiscountCardProps {
  visitCount: number;
}

export default function VisitDiscountCard({ visitCount }: VisitDiscountCardProps) {
  const tier = getDiscountTier(visitCount);

  return (
    <Card className="min-w-0 border shadow-sm">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Loyalitas
          </CardTitle>
          {tier && <Badge variant="secondary">{tier.label}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5">
          <span className="text-3xl font-black text-foreground">{visitCount}</span>
          <span className="mb-1 text-sm text-muted-foreground">kunjungan selesai</span>
        </div>

        {tier && tier.discount > 0 ? (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              Diskon {tier.discount}%
            </p>
            <p className="text-xs text-muted-foreground">
              Diskon otomatis untuk order ini
            </p>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Belum ada diskon. Servis 3x untuk mulai mendapatkan diskon.
          </p>
        )}

        <div className="space-y-1 pt-1">
          {[...discountTiers].reverse().map((item) => (
            <div
              key={item.label}
              className={`flex flex-col gap-0.5 rounded px-2 py-1 text-xs min-[360px]:flex-row min-[360px]:justify-between min-[360px]:gap-3 ${
                tier?.label === item.label
                  ? "bg-foreground font-semibold text-background"
                  : "text-muted-foreground"
              }`}
            >
              <span>{item.label}</span>
              <span className="break-words min-[360px]:text-right">
                {item.minVisits}+ kunjungan -{" "}
                {item.discount > 0 ? `Diskon ${item.discount}%` : "Tanpa diskon"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
