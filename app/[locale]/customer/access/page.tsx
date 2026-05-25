import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerAccessForm } from "./_components/CustomerAccessForm";

interface CustomerAccessPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CustomerAccessPage({
  params,
}: CustomerAccessPageProps) {
  const { locale } = await params;

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
          <Link
            href={`/${locale}/customer`}
            className="flex items-center gap-3 text-sm font-semibold"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
              <Wrench className="size-5" />
            </span>
            PT. Mektek Tanjung Lestari
          </Link>
          <Button asChild variant="outline">
            <Link href={`/${locale}/customer`}>
              <ArrowLeft className="size-4" />
              Customer home
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase text-zinc-500">Customer access</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Login or create your customer account.
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            Existing customers can login with phone and password. New customers
            can create an account and continue to their service profile.
          </p>
        </div>

        <CustomerAccessForm locale={locale} />
      </section>
    </main>
  );
}
