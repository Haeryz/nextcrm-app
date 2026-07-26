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
    <Card className="border-[#151a63]/10 bg-white">
      <CardContent className="flex flex-col gap-6 p-6">
        <div>
          <p className="text-xs text-[#4b5577]">Email Anda</p>
          <p className="truncate text-sm font-semibold text-[#10164f]">{email}</p>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-[#151a63]/10 pt-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pref-marketing" className="text-sm font-semibold text-[#10164f]">
              Email promosi
            </Label>
            <p className="text-xs leading-5 text-[#4b5577]">
              Kabar produk baru, tips perawatan kendaraan, dan info kegiatan Mektek.
            </p>
          </div>
          <Switch
            id="pref-marketing"
            checked={marketingOn}
            onCheckedChange={setMarketingOn}
            disabled={isSaving}
            aria-label="Email promosi"
          />
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-[#151a63]/10 pt-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pref-offers" className="text-sm font-semibold text-[#10164f]">
              Penawaran khusus
            </Label>
            <p className="text-xs leading-5 text-[#4b5577]">
              Diskon, voucher, dan penawaran terbatas untuk pelanggan Mektek.
            </p>
          </div>
          <Switch
            id="pref-offers"
            checked={offersOn}
            onCheckedChange={setOffersOn}
            disabled={isSaving}
            aria-label="Penawaran khusus"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[#151a63]/10 pt-5">
          <p className="text-xs leading-5 text-[#4b5577]">
            Mematikan kedua pilihan tidak memengaruhi email penting seperti kode
            verifikasi, status servis, dan bukti pembayaran.
          </p>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="bg-[#151a63] text-[#fff200] hover:bg-[#10164f] sm:w-fit"
          >
            {isSaving ? "Menyimpan..." : "Simpan preferensi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
