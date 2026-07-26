"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateEmailPreference } from "@/actions/email/preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  userId: string;
  email: string;
  marketing: boolean;
  offers: boolean;
};

// The visual switch is 24px tall; this invisible overlay grows the touch area to
// roughly 48px without changing the control's appearance.
const SWITCH_TAP_TARGET_CLASS =
  "relative mt-1 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']";

export function CustomerEmailPreferencesForm({
  userId,
  email,
  marketing,
  offers,
}: Props) {
  // Seeded from the stored preference. A customer who never opted in starts
  // with both switches off — the page never pre-opts anyone in.
  const [marketingOn, setMarketingOn] = useState(marketing);
  const [offersOn, setOffersOn] = useState(offers);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = marketingOn !== marketing || offersOn !== offers;

  async function onSave() {
    setIsSaving(true);
    try {
      const result = await updateEmailPreference(userId, {
        marketing: marketingOn,
        offers: offersOn,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Preferensi email berhasil disimpan.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Gagal menyimpan preferensi"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="rounded-xl border-primary/10 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-6 p-6">
        <div>
          <p className="text-xs text-muted-foreground">Email Anda</p>
          <p className="truncate text-sm font-semibold text-secondary-foreground">
            {email}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-primary/10 pt-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pref-marketing" className="text-sm font-semibold text-secondary-foreground">
              Email promosi
            </Label>
            <p id="pref-marketing-help" className="text-xs leading-5 text-muted-foreground">
              Kabar produk baru, tips perawatan kendaraan, dan info kegiatan Mektek.
            </p>
          </div>
          <Switch
            id="pref-marketing"
            checked={marketingOn}
            onCheckedChange={setMarketingOn}
            disabled={isSaving}
            aria-describedby="pref-marketing-help"
            className={SWITCH_TAP_TARGET_CLASS}
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-primary/10 pt-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pref-offers" className="text-sm font-semibold text-secondary-foreground">
              Penawaran khusus
            </Label>
            <p id="pref-offers-help" className="text-xs leading-5 text-muted-foreground">
              Diskon, voucher, dan penawaran terbatas untuk pelanggan Mektek.
            </p>
          </div>
          <Switch
            id="pref-offers"
            checked={offersOn}
            onCheckedChange={setOffersOn}
            disabled={isSaving}
            aria-describedby="pref-offers-help"
            className={SWITCH_TAP_TARGET_CLASS}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-primary/10 pt-5">
          <p className="text-xs leading-5 text-muted-foreground">
            Kedua pilihan mati secara bawaan dan hanya aktif bila Anda menyalakannya
            sendiri. Mematikan keduanya tidak memengaruhi email penting seperti kode
            verifikasi, status servis, dan bukti pembayaran.
          </p>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="h-11 sm:w-fit"
          >
            {isSaving ? "Menyimpan..." : "Simpan preferensi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
