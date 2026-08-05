import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MailCheck, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerAccessForm } from "./_components/CustomerAccessForm";
import type { Metadata } from "next";
import { getCustomerSessionUser } from "@/lib/customer-auth";
import { getSafeCustomerReturnPath } from "@/lib/customer-return-path";

interface CustomerAccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ next?: string | string[] }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const ACCESS_HIGHLIGHTS = [
  {
    icon: Wrench,
    title: "Pantau servis Anda",
    body: "Lihat status pengerjaan kendaraan dan riwayat servis kapan saja.",
  },
  {
    icon: MailCheck,
    title: "Verifikasi lewat email",
    body: "Pendaftaran dikonfirmasi dengan kode 6 digit yang kami kirim ke email Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Bengkel Resmi Denso",
    body: "Akun ini menghubungkan data Anda dengan Service Tracking Mektek.",
  },
];

export default async function CustomerAccessPage({
  params,
  searchParams,
}: CustomerAccessPageProps) {
  const { locale } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedNext = Array.isArray(query.next) ? query.next[0] : query.next;
  const returnTo = getSafeCustomerReturnPath(requestedNext, locale);
  const sessionUser = await getCustomerSessionUser();

  if (sessionUser?.id) redirect(returnTo);

  return (
    <main className="min-h-screen bg-[hsl(var(--brand-surface))] text-[hsl(var(--brand-navy-ink))]">
      <header className="border-b border-primary/10 bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Link href={`/${locale}/customer`} className="min-w-0">
            <MektekBrandMark textClassName="text-[hsl(var(--brand-navy-deep))]" />
          </Link>
          <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
            <Link href={`/${locale}/customer`}>
              <ArrowLeft className="size-4" />
              Beranda pelanggan
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:py-14">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Akses pelanggan
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Masuk atau buat akun pelanggan Mektek
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Sudah punya akun? Masuk dengan nomor telepon dan password. Pelanggan
            baru cukup mendaftar sekali, lalu langsung membuka profil servisnya.
          </p>

          <ul className="mt-6 grid gap-3">
            {ACCESS_HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-lg border border-primary/10 bg-card p-4 shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:justify-self-end">
          <CustomerAccessForm locale={locale} returnTo={returnTo} />
        </div>
      </section>
    </main>
  );
}
