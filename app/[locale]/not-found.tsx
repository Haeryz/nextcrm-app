import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Compass, Home, LogIn, ShoppingBag, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Friendly catch-all page for any URL that doesn't match a real page. Rendered
 * automatically by Next.js for unmatched routes and by explicit `notFound()`
 * calls. Kept simple and navigable so a lost visitor always has a clear way back.
 */
export default async function NotFound() {
  let locale = "id";
  try {
    locale = await getLocale();
  } catch {
    // Rendered outside a locale context — fall back to the default.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl bg-zinc-950 text-white">
          <Compass className="size-8" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Halaman yang Anda cari tidak tersedia, mungkin sudah dipindahkan, atau
          Link tersebut tidak lagi berlaku. Silakan pilih tujuan di bawah ini.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/${locale}`}>
              <Home className="size-4" />
              Ke beranda
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/customer?view=sparepart`}>
              <ShoppingBag className="size-4" />
              Lihat katalog
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={`/${locale}/sign-in`}>
              <LogIn className="size-4" />
              Login
            </Link>
          </Button>
        </div>

        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Wrench className="size-3.5" />
          PT. Mektek Tanjung Lestari
        </div>
      </div>
    </main>
  );
}
