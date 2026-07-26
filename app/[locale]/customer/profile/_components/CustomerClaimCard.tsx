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

// Shown when an unclaimed walk-in customer record matches the signed-in user's phone.
// We never display that record's data until the user proves phone ownership via OTP.
export function CustomerClaimCard({ phone }: { phone: string }) {
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
    <Card className="border-[#151a63]/10 bg-white">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#151a63]" />
          <div>
            <h2 className="text-base font-semibold">Verifikasi nomor telepon untuk melihat riwayat servis</h2>
            <p className="mt-1 text-sm leading-6 text-[#4b5577]">
              Kami menemukan catatan servis untuk nomor telepon Anda. Konfirmasikan
              kepemilikan nomor dengan kode WhatsApp untuk menautkannya ke akun ini.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Kode 6 digit"
            className="h-11 flex-1 border-[#151a63]/20 bg-white text-[#10164f]"
            disabled={claiming}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onSend}
            disabled={sending || claiming}
            className="h-11 border-[#151a63]/20 text-[#10164f] hover:bg-[#eef1ff]"
          >
            {sending ? "Mengirim..." : "Kirim kode"}
          </Button>
          <Button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className="h-11 bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
          >
            {claiming ? "Menautkan..." : "Klaim riwayat"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
