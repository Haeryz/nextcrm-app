"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "id";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-8" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {error.digest ? `Kode: ${error.digest}` : "Terjadi kesalahan"}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Maaf, halaman tidak dapat dimuat
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Terjadi kesalahan saat memuat halaman ini. Silakan coba lagi. Jika
          masalah berlanjut, kembali ke beranda atau hubungi tim kami.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => reset()}>
            <RefreshCw className="size-4" />
            Coba lagi
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}`}>
              <Home className="size-4" />
              Ke beranda
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
