"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BellOff,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { confirmWhatsAppOptOut } from "../actions";
import type {
  WhatsAppOptOutOutcome,
  WhatsAppOptOutState,
} from "../optout-state";

type Props = {
  locale: string;
  token: string;
  initialState: WhatsAppOptOutState;
};

type Copy = {
  icon: typeof BellOff;
  tone: "neutral" | "success" | "warning" | "danger";
  title: string;
  body: string;
  note?: string;
};

/**
 * Every rejection reason gets its own wording. A workshop customer who followed a
 * link from WhatsApp cannot act on "token tidak valid" — they need to know
 * whether their request went through, and what to do if it did not.
 */
const COPY: Record<WhatsAppOptOutOutcome, Copy> = {
  confirm: {
    icon: BellOff,
    tone: "neutral",
    title: "Berhenti terima pesan promosi?",
    body: "Kami akan berhenti mengirim pesan promosi dan penawaran ke nomor WhatsApp Anda.",
    note: "Pesan penting tentang servis kendaraan Anda — seperti kendaraan sudah selesai atau tagihan siap dibayar — tetap kami kirim.",
  },
  success: {
    icon: CheckCircle2,
    tone: "success",
    title: "Berhasil. Anda tidak akan menerima promosi lagi.",
    body: "Terima kasih sudah memberi tahu kami. Mulai sekarang nomor WhatsApp Anda tidak akan menerima pesan promosi dari Mektek.",
    note: "Kami tetap mengirim kabar tentang servis kendaraan Anda yang sedang berjalan.",
  },
  already: {
    icon: Info,
    tone: "success",
    title: "Anda memang sudah berhenti berlangganan.",
    body: "Nomor WhatsApp Anda sudah terdaftar untuk tidak menerima pesan promosi. Tidak ada yang perlu Anda lakukan lagi.",
    note: "Kalau Anda masih menerima pesan promosi, hubungi bengkel kami supaya bisa kami periksa.",
  },
  used: {
    icon: Info,
    tone: "warning",
    title: "Tautan ini sudah pernah dipakai.",
    body: "Setiap tautan hanya bisa digunakan satu kali. Kemungkinan besar permintaan Anda sudah tercatat sebelumnya.",
    note: "Kalau Anda masih menerima pesan promosi, buka tautan terbaru dari pesan WhatsApp kami, atau hubungi bengkel kami langsung.",
  },
  expired: {
    icon: Clock,
    tone: "warning",
    title: "Tautan ini sudah kedaluwarsa.",
    body: "Demi keamanan, tautan berhenti berlangganan hanya berlaku selama 30 hari sejak dikirim.",
    note: "Silakan buka tautan dari pesan WhatsApp kami yang paling baru, atau hubungi bengkel kami dan kami akan menghentikan pesan promosi untuk Anda.",
  },
  invalid: {
    icon: XCircle,
    tone: "danger",
    title: "Tautan tidak dikenali.",
    body: "Alamat yang Anda buka tidak lengkap atau tidak cocok dengan data kami. Ini biasa terjadi kalau tautan terpotong saat disalin.",
    note: "Coba tekan langsung tautan pada pesan WhatsApp kami, jangan disalin sebagian. Atau hubungi bengkel kami untuk dibantu.",
  },
  error: {
    icon: ShieldAlert,
    tone: "danger",
    title: "Maaf, terjadi gangguan di sistem kami.",
    body: "Permintaan Anda belum tersimpan. Ini bukan kesalahan Anda.",
    note: "Silakan coba beberapa saat lagi, atau hubungi bengkel kami supaya kami hentikan pesan promosi secara manual.",
  },
};

const TONE_CLASS: Record<Copy["tone"], string> = {
  neutral: "bg-[#151a63]/10 text-[#10164f]",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
};

export function WhatsAppOptOutScreen({ locale, token, initialState }: Props) {
  const [state, setState] = useState<WhatsAppOptOutState>(initialState);
  const [pending, startTransition] = useTransition();

  const copy = COPY[state.outcome] ?? COPY.error;
  const Icon = copy.icon;
  const firstName = (state.customerName ?? "").trim().split(/\s+/)[0] ?? "";

  const submit = () => {
    startTransition(async () => {
      const result = await confirmWhatsAppOptOut(token);
      setState((current) => ({
        ...result,
        customerName: result.customerName ?? current.customerName ?? null,
      }));
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <header className="border-b border-[#151a63]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center px-4 py-4 md:px-6">
          <MektekBrandMark textClassName="text-[#10164f]" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-12">
        <Card className="border-[#151a63]/10 bg-white shadow-sm">
          <CardContent className="p-5 sm:p-7">
            <span
              className={`inline-flex size-11 items-center justify-center rounded-full ${TONE_CLASS[copy.tone]}`}
            >
              <Icon className="size-5" />
            </span>

            {firstName ? (
              <p className="mt-4 text-sm text-[#4b5577]">Halo, {firstName}.</p>
            ) : null}

            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-[#4b5577]">{copy.body}</p>
            {copy.note ? (
              <p className="mt-3 rounded-md border border-[#151a63]/10 bg-[#f7f8ff] px-3 py-3 text-sm leading-6 text-[#4b5577]">
                {copy.note}
              </p>
            ) : null}

            {state.outcome === "confirm" ? (
              // Consuming the token is an explicit action, never a page load.
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-[#10164f] text-white hover:bg-[#151a63] sm:w-auto"
                  disabled={pending}
                  onClick={submit}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Ya, berhenti terima promosi
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#fff200] hover:text-[#10164f] sm:w-auto"
                >
                  <Link href={`/${locale}/customer`}>Batal</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6">
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full border-[#151a63]/20 bg-white text-[#10164f] hover:bg-[#fff200] hover:text-[#10164f] sm:w-auto"
                >
                  <Link href={`/${locale}/customer`}>Kembali ke halaman Mektek</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 px-1 text-xs leading-5 text-[#4b5577]">
          Halaman ini hanya mengatur pesan promosi. Kabar tentang servis kendaraan
          Anda tetap dikirim agar Anda tidak melewatkan informasi penting.
        </p>
      </section>
    </main>
  );
}
