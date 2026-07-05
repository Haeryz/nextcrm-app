import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  LogIn,
  Search,
  UserRound,
  type LucideIcon,
  Wrench,
} from "lucide-react";

import { listMektekCatalogItems } from "@/actions/mektek/catalog-items";
import { getSessionUser } from "@/lib/auth-guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getExistingCatalogImagePath } from "@/lib/catalog-images";
import { CatalogImage } from "@/components/mektek/CatalogImage";
import { CartProvider } from "@/components/mektek/cart/CartProvider";
import { CartButton } from "@/components/mektek/cart/CartButton";
import { CartMount } from "@/components/mektek/cart/CartMount";
import { ItemActions } from "@/components/mektek/cart/ItemActions";

interface CustomerCatalogPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type LandingServiceCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type LandingProcessStep = {
  step: string;
  title: string;
  description: string;
};

type CustomerCatalog = Awaited<ReturnType<typeof listMektekCatalogItems>>;
type CustomerCatalogItem = CustomerCatalog["items"][number];

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatPrice(price: number | null) {
  if (typeof price !== "number") return "Harga belum tersedia";
  return price.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

const landingHighlights: string[] = [
  "Layanan servis alat berat yang lebih terarah",
  "Progress pekerjaan dicatat dengan rapi",
  "Komunikasi customer dibuat lebih mudah",
];

const serviceCards: LandingServiceCard[] = [
  {
    title: "Servis alat berat",
    description: "Pengecekan dan perbaikan untuk membantu unit kembali siap digunakan.",
    icon: Wrench,
  },
  {
    title: "Administrasi rapi",
    description: "Data customer, pekerjaan, biaya, dan dokumen tersimpan dalam satu alur.",
    icon: ClipboardCheck,
  },
  {
    title: "Progress terpantau",
    description: "Alur order servis mendukung update status dan ringkasan pekerjaan customer.",
    icon: CheckCircle2,
  },
];

const processSteps: LandingProcessStep[] = [
  {
    step: "01",
    title: "Sampaikan kebutuhan servis",
    description: "Tim Mektek menerima informasi awal customer, unit, dan keluhan pekerjaan.",
  },
  {
    step: "02",
    title: "Pekerjaan dicatat",
    description: "Setiap update penting bisa dicatat agar status pekerjaan lebih mudah dipantau.",
  },
  {
    step: "03",
    title: "Lanjutkan ke tim Mektek",
    description: "Customer dapat menghubungi tim untuk konfirmasi jadwal, biaya, dan tindak lanjut.",
  },
];

function MektekLanding({ locale }: { locale: string }) {
  const sparepartHref = `/${locale}/customer?view=sparepart`;
  const accessHref = `/${locale}/customer/access`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:py-14 md:px-6 lg:min-h-[760px] lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.98fr)] lg:items-center lg:py-20">
          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-300">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-950">
                <Wrench className="size-5" />
              </span>
              PT. Mektek Tanjung Lestari
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
                MekTek
              </h1>
              <p className="text-base leading-7 text-zinc-300 sm:text-lg">
                Mitra layanan alat berat untuk membantu pencatatan servis, koordinasi
                pekerjaan, dan komunikasi customer berjalan lebih rapi.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                <Link href={sparepartHref}>
                  Buka katalog
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={accessHref}>
                  Login / Sign up
                  <LogIn className="size-4" />
                </Link>
              </Button>
              <p className="text-sm text-zinc-400">
                Use your phone number so we can send you to the right flow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["01", "pencatatan terarah"],
                ["02", "progress mudah dicek"],
                ["03", "komunikasi lebih rapi"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3 shadow-2xl sm:p-5">
              <div className="rounded-md bg-zinc-100 p-3 text-zinc-950 sm:p-4">
                <div className="flex flex-col gap-3 rounded-md border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Mektek service flow</p>
                    <p className="text-xs text-zinc-500">Customer, progress, and follow-up</p>
                  </div>
                  <div className="flex h-10 min-w-0 items-center gap-2 rounded-md border bg-zinc-50 px-3 text-sm text-zinc-500 sm:w-56">
                    <Search className="size-4" />
                    <span className="truncate">Cek status layanan</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Masuk", "Data customer diterima", "Awal"],
                    ["Cek", "Diagnosa pekerjaan dibuat", "Proses"],
                    ["Kerja", "Progress servis diperbarui", "Aktif"],
                    ["Selesai", "Ringkasan siap dibagikan", "Final"],
                  ].map(([status, title, stage]) => (
                    <div key={`${status}-${title}`} className="rounded-md border bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary">{status}</Badge>
                        <span className="text-xs text-zinc-500">{stage}</span>
                      </div>
                      <p className="mt-4 min-h-10 text-sm font-semibold leading-5">{title}</p>
                      <div className="mt-3 h-2 rounded-full bg-zinc-100">
                        <div className="h-2 w-2/3 rounded-full bg-zinc-800" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Customer", "Data awal"],
                    ["Progress", "Update kerja"],
                    ["Dokumen", "Ringkasan akhir"],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-md border bg-zinc-50 p-3">
                      <p className="text-xs font-semibold text-zinc-950">{title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 md:px-6">
        {landingHighlights.map((item: string) => (
          <div key={item} className="flex items-start gap-3 rounded-md border bg-card p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium leading-6">{item}</p>
          </div>
        ))}
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-[0.85fr_1.15fr] md:px-6 lg:py-14">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase text-muted-foreground">Informasi Mektek</p>
            <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Layanan servis dengan pencatatan yang lebih jelas.
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Halaman customer ini dibuat sebagai pintu masuk sederhana untuk mengenalkan
              Mektek. Fokusnya adalah membantu customer memahami alur layanan sebelum masuk
              ke halaman katalog.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {serviceCards.map((item: LandingServiceCard) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="rounded-md border bg-background p-4">
                  <Icon className="size-6 text-zinc-800" />
                  <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase text-muted-foreground">Cara mulai</p>
            <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Mulai dari informasi singkat, lalu lanjut saat siap.
            </h2>
          </div>

          <div className="grid gap-4">
            {processSteps.map((item: LandingProcessStep) => (
              <div key={item.step} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[4rem_1fr]">
                <p className="text-sm font-semibold text-muted-foreground">{item.step}</p>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 md:px-6 lg:pb-14">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 rounded-md bg-zinc-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-lg font-semibold">Siap melanjutkan?</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Masuk ke halaman katalog setelah membaca informasi Mektek.
            </p>
          </div>
          <Button asChild className="bg-white text-zinc-950 hover:bg-zinc-200">
            <Link href={sparepartHref}>
              Buka katalog
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default async function CustomerCatalogPage({
  params,
  searchParams,
}: CustomerCatalogPageProps) {
  const { locale = "en" } = params ? await params : { locale: "en" };
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = readSearchParam(resolvedSearchParams, "view");
  const query = readSearchParam(resolvedSearchParams, "q");
  const machine = readSearchParam(resolvedSearchParams, "machine");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);

  if (view !== "sparepart" && !query && !machine && page === 1) {
    return <MektekLanding locale={locale} />;
  }

  const [catalog, sessionUser] = await Promise.all([
    listMektekCatalogItems({
      query,
      machine,
      page,
      pageSize: 24,
    }),
    getSessionUser(),
  ]);
  const isAuthenticated = !!sessionUser?.id;

  const baseParams = new URLSearchParams();
  baseParams.set("view", "sparepart");
  if (query) baseParams.set("q", query);
  if (machine) baseParams.set("machine", machine);
  const pageHref = (targetPage: number) => {
    const nextParams = new URLSearchParams(baseParams);
    nextParams.set("page", String(targetPage));
    return `/${locale}/customer?${nextParams.toString()}`;
  };

  return (
    <CartProvider locale={locale} isAuthenticated={isAuthenticated}>
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase text-muted-foreground">
                MekTek Catalogue
              </p>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Sparepart catalogue
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Browse available machine parts by model, part number, or description.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild variant="outline">
                <Link href={`/${locale}/customer`}>
                  <ArrowLeft className="size-4" />
                  Customer home
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/${locale}/customer/profile`}>
                  <UserRound className="size-4" />
                  Back to profile
                </Link>
              </Button>
              <CartButton />
            </div>
          </div>

          <form
            action={`/${locale}/customer`}
            className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_220px_auto]"
          >
            <input type="hidden" name="view" value="sparepart" />
            <Input
              name="q"
              placeholder="Search part number, item name, or description"
              defaultValue={query}
            />
            <Input name="machine" placeholder="Machine" defaultValue={machine} />
            <Button type="submit">
              <Search data-icon="inline-start" />
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {catalog.totalCount} item{catalog.totalCount === 1 ? "" : "s"} found
          </p>
          {(query || machine) && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${locale}/customer?view=sparepart`}>Clear filters</Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalog.items.map((item: CustomerCatalogItem) => {
            const imagePath = getExistingCatalogImagePath(item.imagePath);

            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-[4/3] bg-muted">
                  <CatalogImage src={imagePath} alt={item.description} />
                </div>
                <CardContent className="flex min-h-56 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="max-w-[70%] truncate">
                      {item.machine}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Row {item.rowNumber}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <h2 className="line-clamp-2 text-base font-semibold">
                      {item.description}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {item.catalogPartNumber || item.partNumber || "No part number"}
                    </p>
                    {item.remark && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {item.remark}
                      </p>
                    )}
                  </div>
                  {typeof item.price === "number" && item.price > 0 ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-base font-semibold">
                        {formatPrice(item.price)}
                      </p>
                      <ItemActions
                        item={{
                          id: item.id,
                          description: item.description,
                          price: item.price,
                          machine: item.machine ?? null,
                          partNumber: item.partNumber ?? null,
                          catalogPartNumber: item.catalogPartNumber ?? null,
                          imagePath: item.imagePath ?? null,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">
                          Harga belum tersedia
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Segera hadir
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                        Pre-order
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {catalog.items.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No catalogue items match this search.
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {catalog.page} of {catalog.totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={catalog.page <= 1}>
              <Link href={pageHref(Math.max(1, catalog.page - 1))}>Previous</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={catalog.page >= catalog.totalPages}
            >
              <Link href={pageHref(Math.min(catalog.totalPages, catalog.page + 1))}>
                Next
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <CartMount />
    </main>
    </CartProvider>
  );
}
