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
          <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
            Loyalitas
          </CardTitle>
          {tier && (
            <Badge variant="secondary">{tier.label}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black text-foreground">{visitCount}</span>
          <span className="text-sm text-muted-foreground mb-1">kunjungan</span>
        </div>

        {tier && tier.discount > 0 ? (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              Diskon {tier.discount}%
            </p>
            <p className="text-xs text-muted-foreground">
              Berlaku untuk servis berikutnya
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Belum ada diskon. Servis 3x untuk mulai mendapatkan diskon.
          </p>
        )}

        {/* Tier ladder */}
        <div className="space-y-1 pt-1">
          {[...discountTiers].reverse().map((t) => (
            <div
              key={t.label}
              className={`flex justify-between text-xs px-2 py-1 rounded ${
                tier?.label === t.label
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <span>{t.label}</span>
              <span>{t.minVisits}+ kunjungan · {t.discount > 0 ? `${t.discount}% off` : "No discount"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
