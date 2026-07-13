import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock,
  Fan,
  Gauge,
  LogIn,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
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
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";

interface CustomerCatalogPageProps {
  params?: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type LandingServiceCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type LandingInfoCard = {
  title: string;
  value: string;
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

const marqueeItems: string[] = [
  "Denso Authorized Workshop",
  "Authorized Air Conditioner Dealer",
  "Automotive AC Service",
  "Engine Tune Up",
  "Brake & Suspension",
];

const landingHighlights: string[] = [
  "Dealer Authorized Air Conditioner",
  "Bengkel Resmi Denso di Tabalong",
  "Layanan mobil lengkap untuk kenyamanan perjalanan",
];

const contactDetails: LandingInfoCard[] = [
  {
    title: "Hari operasional",
    value: "Senin - Sabtu",
    description: "Tanggal merah tutup",
    icon: CalendarDays,
  },
  {
    title: "Jam buka",
    value: "08.00 - 17.00",
    description: "Datang sesuai jam layanan bengkel",
    icon: Clock,
  },
  {
    title: "Lokasi",
    value: "Murung Pudak, Tabalong",
    description: "Jl. Jend A Yani RT.01 Kel. Mabu'un, Kalimantan Selatan 71571",
    icon: MapPin,
  },
];

const serviceCards: LandingServiceCard[] = [
  {
    title: "AC Mobil",
    description: "Pemeriksaan dan perawatan sistem AC agar kabin tetap nyaman selama perjalanan.",
    icon: Fan,
  },
  {
    title: "Engine Tune Up",
    description: "Pengecekan performa mesin untuk membantu kendaraan bekerja lebih stabil.",
    icon: Gauge,
  },
  {
    title: "Oli & Battery",
    description: "Penggantian oli dan layanan battery untuk menjaga kendaraan siap digunakan.",
    icon: BatteryCharging,
  },
  {
    title: "Brake & Suspension",
    description: "Pemeriksaan rem dan suspensi untuk membantu kenyamanan dan keamanan berkendara.",
    icon: CarFront,
  },
];

const processSteps: LandingProcessStep[] = [
  {
    step: "01",
    title: "Datang ke bengkel",
    description: "Sampaikan kebutuhan servis mobil Anda kepada tim PT Mektek Tanjung Lestari.",
  },
  {
    step: "02",
    title: "Pengecekan kendaraan",
    description: "Tim melakukan pemeriksaan awal untuk menentukan layanan yang tepat.",
  },
  {
    step: "03",
    title: "Servis dan tindak lanjut",
    description: "Pekerjaan dilanjutkan sesuai kebutuhan AC, mesin, oli, battery, rem, atau suspensi.",
  },
];

function MektekLanding({ locale }: { locale: string }) {
  const sparepartHref = `/${locale}/customer?view=sparepart`;
  const accessHref = `/${locale}/customer/access`;

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[#0b1151] text-white">
        <div aria-hidden className="absolute inset-0">
          {/* Replace this visual placeholder with the real workshop photo when available. */}
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#070b36_0%,#12176a_48%,#fff200_160%)]" />
          <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-[repeating-linear-gradient(135deg,rgba(255,242,0,0.25)_0px,rgba(255,242,0,0.25)_1px,transparent_1px,transparent_16px)] opacity-50 lg:block" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,8,32,0.97)_0%,rgba(9,15,75,0.88)_48%,rgba(9,15,75,0.38)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent to-[#f7f8ff]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 md:px-6 lg:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <MektekBrandMark
              priority
              markClassName="size-12 sm:size-14"
              textClassName="text-white"
            />
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="border-white/25 bg-white/10 text-white hover:bg-[#fff200] hover:text-[#10164f]"
              >
                <Link href={accessHref}>
                  Customer access
                  <LogIn className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-5 py-5 sm:gap-7 sm:py-7 lg:gap-8 lg:py-10">
            <div className="max-w-4xl space-y-4 sm:space-y-7">
              <div className="inline-flex items-center gap-2 rounded-md border border-[#fff200]/35 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-zinc-100 sm:py-2">
                <BadgeCheck className="size-4 text-[#fff200]" />
                Denso Authorized Workshop & AC Dealer
              </div>

              <div className="space-y-3 sm:space-y-5">
                <h1 className="max-w-4xl text-4xl font-semibold leading-[1.04] sm:text-5xl lg:text-7xl">
                  PT Mektek Tanjung Lestari
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-200 sm:text-lg sm:leading-7">
                  Dealer Authorized Air Conditioner dan Bengkel Resmi Denso di
                  Tabalong untuk AC mobil, engine tune up, ganti oli, battery,
                  brake, dan suspension.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button asChild size="lg" className="h-10 bg-[#fff200] text-[#10164f] hover:bg-[#f5e900] sm:h-11">
                  <Link href={sparepartHref}>
                    Buka katalog
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-10 border-white/30 bg-white/10 text-white hover:bg-white hover:text-[#10164f] sm:h-11"
                >
                  <Link href="#services">
                    Lihat layanan
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="max-w-6xl rounded-md border border-white/15 bg-white/[0.07] p-2 shadow-sm backdrop-blur sm:p-2.5">
              <dl className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.55fr)]">
                {contactDetails.map((item: LandingInfoCard) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-md bg-white/[0.08] px-3 py-2.5"
                    >
                      <dt className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#fff200] text-[#10164f]">
                        <Icon className="size-4" />
                        <span className="sr-only">{item.title}</span>
                      </dt>
                      <dd className="min-w-0">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-blue-100/70">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold leading-5 text-white sm:text-base">
                          {item.value}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-blue-50/80">
                          {item.description}
                        </p>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        </div>

        <div className="relative z-10 shrink-0 overflow-hidden border-y border-[#fff200]/30 bg-[#fff200] text-[#10164f]">
          <div className="animate-mektek-marquee flex w-max items-center py-2 sm:py-3">
            {[0, 1].map((group) => (
              <div key={group} className="flex shrink-0 items-center gap-8 pr-8">
                {marqueeItems.map((item: string) => (
                  <div key={`${group}-${item}`} className="flex items-center gap-3">
                    <Sparkles className="size-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 md:px-6">
        {landingHighlights.map((item: string) => (
          <div
            key={item}
            className="flex items-start gap-3 rounded-md border border-[#151a63]/10 bg-white p-4 shadow-sm"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#151a63]" />
            <p className="text-sm font-medium leading-6">{item}</p>
          </div>
        ))}
      </section>

      <section id="services" className="border-y border-[#151a63]/10 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 md:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:py-16">
          <div className="space-y-4">
            <Badge className="bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
              Official Denso Service
            </Badge>
            <h2 className="text-2xl font-semibold leading-tight sm:text-4xl">
              Perawatan mobil yang rapi, jelas, dan ditangani bengkel resmi Denso.
            </h2>
            <p className="text-sm leading-6 text-[#4b5577] sm:text-base">
              PT Mektek Tanjung Lestari melayani kebutuhan servis kendaraan di
              Kecamatan Murung Pudak, Kabupaten Tabalong, Kalimantan Selatan.
              Datang untuk menjaga AC tetap nyaman dan kendaraan siap digunakan.
            </p>
            <div className="flex items-start gap-3 rounded-md border-l-4 border-[#fff200] bg-[#f8f9ff] p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#151a63]" />
              <p className="text-sm leading-6 text-[#26305f]">
                Yuk service mobilnya ke Dealer Resmi Denso Mektek Tanjung agar
                pengemudi dan penumpang merasa nyaman di perjalanan.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {serviceCards.map((item: LandingServiceCard) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-md border border-[#151a63]/10 bg-[#fafbff] p-5 shadow-sm"
                >
                  <div className="flex size-11 items-center justify-center rounded-md bg-[#151a63] text-[#fff200]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4b5577]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#151a63]">
              Cara mulai
            </p>
            <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Mulai dari kebutuhan servis, lalu lanjutkan dengan pengecekan kendaraan.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-[#4b5577]">
              Alur dibuat sederhana untuk customer yang ingin langsung datang ke
              bengkel atau melihat katalog sparepart terlebih dahulu.
            </p>
          </div>

          <div className="grid gap-4">
            {processSteps.map((item: LandingProcessStep) => (
              <div
                key={item.step}
                className="grid gap-3 rounded-md border border-[#151a63]/10 bg-white p-5 shadow-sm sm:grid-cols-[4rem_1fr]"
              >
                <p className="text-sm font-semibold text-[#151a63]">{item.step}</p>
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#4b5577]">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1151] text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div>
            <p className="text-lg font-semibold">Siap service di PT Mektek Tanjung Lestari?</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-50/70">
              Buka katalog sparepart atau lanjut ke akses customer untuk melihat alur
              layanan yang tersedia.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-[#fff200] text-[#10164f] hover:bg-[#f5e900]">
              <Link href={sparepartHref}>
                Buka katalog
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={accessHref}>
                Customer access
                <LogIn className="size-4" />
              </Link>
            </Button>
          </div>
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
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <section className="border-b border-[#151a63]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/${locale}/customer`} className="min-w-0">
              <MektekBrandMark textClassName="text-[#10164f]" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#151a63]">
                MekTek Catalogue
              </p>
              <h1 className="text-3xl font-semibold md:text-4xl">
                Sparepart catalogue
              </h1>
              <p className="max-w-2xl text-sm text-[#4b5577] md:text-base">
                Browse available machine parts by model, part number, or description.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="outline"
                className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
              >
                <Link href={`/${locale}/customer`}>
                  <ArrowLeft className="size-4" />
                  Customer home
                </Link>
              </Button>
              <Button
                asChild
                className="bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
              >
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
            className="grid gap-3 rounded-md border border-[#151a63]/10 bg-[#fafbff] p-3 shadow-sm md:grid-cols-[1fr_220px_auto]"
          >
            <input type="hidden" name="view" value="sparepart" />
            <Input
              name="q"
              placeholder="Search part number, item name, or description"
              defaultValue={query}
              className="border-[#151a63]/20 bg-white text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
            />
            <Input
              name="machine"
              placeholder="Machine"
              defaultValue={machine}
              className="border-[#151a63]/20 bg-white text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
            />
            <Button
              type="submit"
              className="bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
            >
              <Search data-icon="inline-start" />
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#4b5577]">
            {catalog.totalCount} item{catalog.totalCount === 1 ? "" : "s"} found
          </p>
          {(query || machine) && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#151a63] hover:bg-[#eef1ff] hover:text-[#10164f]"
            >
              <Link href={`/${locale}/customer?view=sparepart`}>Clear filters</Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalog.items.map((item: CustomerCatalogItem) => {
            const imagePath = getExistingCatalogImagePath(item.imagePath);

            return (
              <Card
                key={item.id}
                className="overflow-hidden border-[#151a63]/10 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-[#eef1ff]">
                  <CatalogImage src={imagePath} alt={item.description} />
                </div>
                <CardContent className="flex min-h-56 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge className="max-w-[70%] truncate bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
                      {item.machine}
                    </Badge>
                    <span className="text-xs text-[#4b5577]">Row {item.rowNumber}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <h2 className="line-clamp-2 text-base font-semibold">
                      {item.description}
                    </h2>
                    <p className="text-sm text-[#4b5577]">
                      {item.catalogPartNumber || item.partNumber || "No part number"}
                    </p>
                    {item.remark && (
                      <p className="line-clamp-2 text-xs text-[#4b5577]">
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
                    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-[#151a63]/20 bg-[#eef1ff]/70 px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-[#4b5577]">
                          Harga belum tersedia
                        </span>
                        <span className="text-xs text-[#4b5577]">
                          Segera hadir
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-[#151a63]/25 text-[#151a63]"
                      >
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
          <Card className="border-[#151a63]/10 bg-white">
            <CardContent className="p-10 text-center text-sm text-[#4b5577]">
              No catalogue items match this search.
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 border-t border-[#151a63]/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#4b5577]">
            Page {catalog.page} of {catalog.totalPages}
          </p>
          <div className="flex gap-2">
            {catalog.page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
              >
                <Link href={pageHref(catalog.page - 1)}>Previous</Link>
              </Button>
            )}
            {catalog.page >= catalog.totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
              >
                <Link href={pageHref(catalog.page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
      <CartMount />
    </main>
    </CartProvider>
  );
}
