import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerAccessForm } from "./_components/CustomerAccessForm";

interface CustomerAccessPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CustomerAccessPage({
  params,
}: CustomerAccessPageProps) {
  const { locale } = await params;

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
            <Button asChild variant="ghost">
              <Link href={`/${locale}/sign-in`}>
                <ShieldCheck className="size-4" />
                Staff login
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#fff200] hover:text-[#10164f]"
            >
              <Link href={`/${locale}/customer`}>
                <ArrowLeft className="size-4" />
                Customer home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#151a63]">
            Customer access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Login or create your customer account.
          </h1>
          <p className="mt-4 text-base leading-7 text-[#4b5577]">
            Existing customers can login with phone and password. New customers
            can create an account and continue to their service profile.
          </p>
          <div className="mt-6 rounded-md border border-[#151a63]/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Denso Authorized Workshop</p>
            <p className="mt-1 text-sm leading-6 text-[#4b5577]">
              This account connects your phone number to Mektek service tracking
              and customer updates.
            </p>
          </div>
        </div>

        <CustomerAccessForm locale={locale} />
      </section>
    </main>
  );
}
