"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { requestCustomerPhoneOtp } from "@/actions/auth/phone-otp";
import { claimMektekCustomerByPhone } from "@/actions/mektek/customer-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Shown when an unclaimed walk-in customer record matches the signed-in user's phone.
// We never display that record's data until the user proves phone ownership via OTP.
export function CustomerClaimCard({
  phone,
  cardClassName,
}: {
  phone: string;
  cardClassName?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function onSend() {
    if (!phone) {
      toast.error("Akun Anda tidak memiliki nomor telepon.");
      return;
    }
    setSending(true);
    try {
      const result = await requestCustomerPhoneOtp(phone);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Kode verifikasi dikirim via WhatsApp.");
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengirim kode");
    } finally {
      setSending(false);
    }
  }

  async function onClaim() {
    if (!code.trim()) {
      toast.error("Masukkan kode verifikasi.");
      return;
    }
    setClaiming(true);
    try {
      const result = await claimMektekCustomerByPhone(code);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Riwayat servis berhasil ditautkan.");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Gagal menautkan riwayat");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section aria-labelledby="profile-claim-heading">
      <Card className={cn(cardClassName)}>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            </span>
            <div className="min-w-0">
              <h2 id="profile-claim-heading" className="text-lg font-semibold tracking-tight">
                Verifikasi nomor telepon untuk melihat riwayat servis
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Kami menemukan catatan servis untuk nomor telepon Anda. Konfirmasikan
                kepemilikan nomor dengan kode WhatsApp untuk menautkannya ke akun ini.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-otp-code" className="text-sm font-semibold">
              Kode verifikasi WhatsApp
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="claim-otp-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Kode 6 digit"
                aria-describedby="claim-otp-help"
                className="h-11 flex-1 border-primary/20 bg-card"
                disabled={claiming}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onSend}
                disabled={sending || claiming}
                className="h-11"
              >
                {sending ? "Mengirim..." : "Kirim kode"}
              </Button>
              <Button
                type="button"
                onClick={onClaim}
                disabled={claiming}
                className="h-11"
              >
                {claiming ? "Menautkan..." : "Klaim riwayat"}
              </Button>
            </div>
            <p id="claim-otp-help" className="text-xs leading-5 text-muted-foreground">
              Kode berlaku 5 menit dan hanya dapat dipakai sekali. Riwayat servis
              baru ditampilkan setelah kode terverifikasi.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
