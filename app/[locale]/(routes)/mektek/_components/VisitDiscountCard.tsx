import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDiscountTier, discountTiers } from "../_lib/constants";

interface VisitDiscountCardProps {
  visitCount: number;
}

export default function VisitDiscountCard({ visitCount }: VisitDiscountCardProps) {
  const tier = getDiscountTier(visitCount);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Loyalitas
          </CardTitle>
          {tier && <Badge variant="secondary">{tier.label}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-1">
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
              className={`flex justify-between rounded px-2 py-1 text-xs ${
                tier?.label === item.label
                  ? "bg-foreground font-semibold text-background"
                  : "text-muted-foreground"
              }`}
            >
              <span>{item.label}</span>
              <span>
                {item.minVisits}+ kunjungan -{" "}
                {item.discount > 0 ? `${item.discount}% off` : "No discount"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
