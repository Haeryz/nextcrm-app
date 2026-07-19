import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerAccessForm } from "./_components/CustomerAccessForm";
import { getCustomerSessionUser } from "@/lib/customer-auth";
import { getSafeCustomerReturnPath } from "@/lib/customer-return-path";

interface CustomerAccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ next?: string | string[] }>;
}

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
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <header className="border-b border-[#151a63]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Link
            href={`/${locale}/customer`}
            className="min-w-0"
          >
            <MektekBrandMark textClassName="text-[#10164f]" />
          </Link>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#fff200] hover:text-[#10164f]"
            >
              <Link href={`/${locale}/customer`}>
                <ArrowLeft className="size-4" />
                Beranda pelanggan
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#151a63]">
            Akses pelanggan
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Login atau buat akun pelanggan Anda.
          </h1>
          <p className="mt-4 text-base leading-7 text-[#4b5577]">
            Pelanggan lama dapat Login dengan nomor telepon dan Password.
            Pelanggan baru dapat membuat akun lalu membuka profil servisnya.
          </p>
          <div className="mt-6 rounded-md border border-[#151a63]/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Bengkel Resmi Denso</p>
            <p className="mt-1 text-sm leading-6 text-[#4b5577]">
              Account ini menghubungkan nomor telepon Anda dengan Service Tracking
              Mektek dan informasi terbaru untuk pelanggan.
            </p>
          </div>
        </div>

        <CustomerAccessForm locale={locale} returnTo={returnTo} />
      </section>
    </main>
  );
}
