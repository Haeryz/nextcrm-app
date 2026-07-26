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
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { getMektekCatalogHighlights, listMektekCatalogItems } from "@/actions/mektek/catalog-items";
import { getCustomerSessionUser } from "@/lib/customer-auth";
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
import CustomerCatalogHighlights from "./_components/CustomerCatalogHighlights";

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

/*
 * Shared style tokens for this page.
 *
 * Colours come from the `.customer-light` brand scope in `app/[locale]/globals.css`
 * (`--primary` is the brand navy, `--brand-*` is the rest of the scale). Nothing here
 * should hardcode a hex literal — the palette has exactly one source of truth.
 *
 * The class constants below exist because the hero, the trust strip, the service
 * grid and the catalogue grid are sibling surfaces: they previously used three
 * different radii, four near-identical off-whites and two heading scales for no
 * reason. Reusing one constant keeps them in step.
 */
const PAGE_SHELL = "mx-auto w-full max-w-7xl px-4 md:px-6";
const CARD_SURFACE = "rounded-xl border border-primary/10 bg-card shadow-sm";
const SECTION_HEADING =
  "text-2xl font-semibold leading-tight text-[hsl(var(--brand-navy-ink))] sm:text-3xl lg:text-4xl";
const EYEBROW = "text-sm font-semibold uppercase tracking-[0.18em] text-primary";
const BODY_TEXT = "text-sm leading-6 text-[hsl(var(--brand-muted))]";
const OUTLINE_BUTTON = "border-primary/20 text-[hsl(var(--brand-navy-deep))]";
const OUTLINE_BUTTON_ON_LIGHT = `${OUTLINE_BUTTON} bg-card/80`;
const OUTLINE_BUTTON_ON_DARK =
  "border-white/30 bg-white/10 text-white hover:bg-white hover:text-[hsl(var(--brand-navy-deep))]";
const YELLOW_BUTTON =
  "bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))] hover:bg-[hsl(var(--brand-yellow))]/90";
const ACCENT_BADGE =
  "border-transparent bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))] hover:bg-[hsl(var(--brand-yellow))]";

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

/**
 * Availability is the second decision driver after price, so it never relies on
 * colour alone: each state carries its own icon *and* its own wording.
 */
function AvailabilityPill({ available }: { available: boolean }) {
  const Icon = available ? CheckCircle2 : Timer;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold leading-5 ${
        available
          ? "bg-[hsl(var(--brand-surface-alt))] text-[hsl(var(--brand-navy-deep))]"
          : "border border-dashed border-primary/30 text-[hsl(var(--brand-muted))]"
      }`}
    >
      <Icon aria-hidden="true" className="size-3" />
      {available ? "Siap dibeli" : "Pre-order"}
    </span>
  );
}

const marqueeItems: string[] = [
  "Bengkel Resmi Denso",
  "Dealer Resmi Pendingin Udara",
  "Servis AC Mobil",
  "Tune-up Mesin",
  "Rem & Suspensi",
];

const landingHighlights: string[] = [
  "Dealer Resmi Pendingin Udara",
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
    title: "Tune-up Mesin",
    description: "Pengecekan performa mesin untuk membantu kendaraan bekerja lebih stabil.",
    icon: Gauge,
  },
  {
    title: "Oli & Aki",
    description: "Penggantian oli dan layanan aki untuk menjaga kendaraan siap digunakan.",
    icon: BatteryCharging,
  },
  {
    title: "Rem & Suspensi",
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
    description: "Pekerjaan dilanjutkan sesuai kebutuhan AC, mesin, oli, aki, rem, atau suspensi.",
  },
];

function MektekLanding({
  locale,
  isAuthenticated,
  customerName,
}: {
  locale: string;
  isAuthenticated: boolean;
  customerName?: string | null;
}) {
  const sparepartHref = `/${locale}/customer?view=sparepart`;
  const accessHref = isAuthenticated
    ? `/${locale}/customer/profile`
    : `/${locale}/customer/access`;
  const accessLabel = isAuthenticated
    ? customerName?.trim() || "Akun saya"
    : "Akses pelanggan";

  return (
    <main className="min-h-screen bg-[hsl(var(--brand-surface))] text-[hsl(var(--brand-navy-ink))]">
      <section
        aria-labelledby="beranda-judul"
        className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[hsl(var(--brand-navy-deep))] text-white"
      >
        <div aria-hidden="true" className="absolute inset-0">
          {/* Replace this visual placeholder with the real workshop photo when available. */}
          <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--brand-navy-ink))_0%,hsl(var(--brand-navy))_48%,hsl(var(--brand-yellow))_160%)]" />
          <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-[repeating-linear-gradient(135deg,hsl(var(--brand-yellow)_/_0.25)_0px,hsl(var(--brand-yellow)_/_0.25)_1px,transparent_1px,transparent_16px)] opacity-50 lg:block" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,hsl(var(--brand-navy-ink)_/_0.97)_0%,hsl(var(--brand-navy-ink)_/_0.88)_48%,hsl(var(--brand-navy-ink)_/_0.38)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent to-[hsl(var(--brand-surface))]" />
        </div>

        <div className={`relative z-10 flex flex-1 flex-col py-4 lg:py-7 ${PAGE_SHELL}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <MektekBrandMark
              priority
              markClassName="size-12 sm:size-14"
              textClassName="text-white"
            />
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className={OUTLINE_BUTTON_ON_DARK}>
                <Link href={accessHref}>
                  {accessLabel}
                  {isAuthenticated ? (
                    <UserRound aria-hidden="true" />
                  ) : (
                    <LogIn aria-hidden="true" />
                  )}
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-5 py-5 sm:gap-7 sm:py-7 lg:gap-8 lg:py-10">
            <div className="max-w-4xl space-y-4 sm:space-y-7">
              <p className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--brand-yellow))]/35 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-100 sm:py-2">
                <BadgeCheck aria-hidden="true" className="size-4 text-[hsl(var(--brand-yellow))]" />
                Bengkel Resmi Denso &amp; Dealer AC
              </p>

              <div className="space-y-3 sm:space-y-5">
                <h1
                  id="beranda-judul"
                  className="max-w-4xl text-4xl font-semibold leading-[1.04] sm:text-5xl lg:text-7xl"
                >
                  PT Mektek Tanjung Lestari
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-200 sm:text-lg sm:leading-7">
                  Dealer Resmi Pendingin Udara dan Bengkel Resmi Denso di
                  Tabalong untuk AC mobil, tune-up mesin, ganti oli, aki,
                  rem, dan suspensi.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button asChild size="lg" className={`h-10 sm:h-11 ${YELLOW_BUTTON}`}>
                  <Link href={sparepartHref}>
                    Buka katalog
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className={`h-10 sm:h-11 ${OUTLINE_BUTTON_ON_DARK}`}
                >
                  <Link href="#layanan">
                    Lihat layanan
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="max-w-6xl rounded-xl border border-white/15 bg-white/[0.07] p-2 shadow-sm backdrop-blur sm:p-2.5">
              <dl className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.55fr)]">
                {contactDetails.map((item: LandingInfoCard) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-lg bg-white/[0.08] px-3 py-2.5"
                    >
                      <dt className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))]">
                        <Icon aria-hidden="true" className="size-4" />
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

        {/*
          Decorative repetition of claims already stated in the hero badge, the trust
          strip and the service grid — duplicating it for screen readers would only
          add noise, and the second copy exists purely to make the loop seamless.
        */}
        <div
          aria-hidden="true"
          className="relative z-10 shrink-0 overflow-hidden border-y border-[hsl(var(--brand-yellow))]/30 bg-[hsl(var(--brand-yellow))] text-[hsl(var(--brand-navy-deep))]"
        >
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

      <section aria-label="Keunggulan MekTek" className={`${PAGE_SHELL} py-10 lg:py-12`}>
        <ul role="list" className="grid gap-4 md:grid-cols-3">
          {landingHighlights.map((item: string) => (
            <li key={item} className={`flex items-start gap-3 p-5 ${CARD_SURFACE}`}>
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm font-medium leading-6">{item}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="layanan"
        aria-labelledby="layanan-judul"
        className="border-y border-primary/10 bg-card"
      >
        <div
          className={`${PAGE_SHELL} grid gap-8 py-12 lg:grid-cols-[0.82fr_1.18fr] lg:py-16`}
        >
          <div className="space-y-4">
            <Badge className={ACCENT_BADGE}>Servis Resmi Denso</Badge>
            <h2 id="layanan-judul" className={SECTION_HEADING}>
              Perawatan mobil yang rapi, jelas, dan ditangani bengkel resmi Denso.
            </h2>
            <p className={`${BODY_TEXT} sm:text-base`}>
              PT Mektek Tanjung Lestari melayani kebutuhan servis kendaraan di
              Kecamatan Murung Pudak, Kabupaten Tabalong, Kalimantan Selatan.
              Datang untuk menjaga AC tetap nyaman dan kendaraan siap digunakan.
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-primary/10 border-l-4 border-l-[hsl(var(--brand-yellow))] bg-[hsl(var(--brand-surface))] p-5">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-[hsl(var(--brand-navy-deep))]">
                Yuk servis mobilnya ke Dealer Resmi Denso Mektek Tanjung agar
                pengemudi dan penumpang merasa nyaman di perjalanan.
              </p>
            </div>
          </div>

          <ul role="list" className="grid gap-4 sm:grid-cols-2">
            {serviceCards.map((item: LandingServiceCard) => {
              const Icon = item.icon;

              return (
                <li
                  key={item.title}
                  className="rounded-xl border border-primary/10 bg-[hsl(var(--brand-surface))] p-5 shadow-sm"
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                  <p className={`mt-2 ${BODY_TEXT}`}>{item.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="alur-judul" className={`${PAGE_SHELL} py-12 lg:py-16`}>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-4">
            <p className={EYEBROW}>Cara mulai</p>
            <h2 id="alur-judul" className={SECTION_HEADING}>
              Mulai dari kebutuhan servis, lalu lanjutkan dengan pengecekan kendaraan.
            </h2>
            <p className={`max-w-xl ${BODY_TEXT}`}>
              Alur dibuat sederhana untuk pelanggan yang ingin langsung datang ke
              bengkel atau melihat katalog sparepart terlebih dahulu.
            </p>
          </div>

          <ol className="grid gap-4">
            {processSteps.map((item: LandingProcessStep) => (
              <li
                key={item.step}
                className={`grid gap-3 p-5 sm:grid-cols-[4rem_1fr] ${CARD_SURFACE}`}
              >
                <p className="text-sm font-semibold tabular-nums text-primary">
                  <span className="sr-only">Langkah </span>
                  {item.step}
                </p>
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className={`mt-1 ${BODY_TEXT}`}>{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-label="Ajakan servis"
        className="bg-[hsl(var(--brand-navy-deep))] text-white"
      >
        <div
          className={`${PAGE_SHELL} flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:py-12`}
        >
          <div>
            <p className="text-lg font-semibold">Siap servis di PT Mektek Tanjung Lestari?</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-50/70">
              Buka katalog sparepart atau lanjut ke akses pelanggan untuk melihat alur
              layanan yang tersedia.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className={YELLOW_BUTTON}>
              <Link href={sparepartHref}>
                Buka katalog
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={accessHref}>
                {accessLabel}
                {isAuthenticated ? (
                  <UserRound aria-hidden="true" />
                ) : (
                  <LogIn aria-hidden="true" />
                )}
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
  const { locale = "id" } = params ? await params : { locale: "id" };
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const view = readSearchParam(resolvedSearchParams, "view");
  const query = readSearchParam(resolvedSearchParams, "q");
  const machine = readSearchParam(resolvedSearchParams, "machine");
  const page = Math.max(Number(readSearchParam(resolvedSearchParams, "page")) || 1, 1);
  const sessionUser = await getCustomerSessionUser();
  const isAuthenticated = !!sessionUser?.id;

  if (view !== "sparepart" && !query && !machine && page === 1) {
    return (
      <MektekLanding
        locale={locale}
        isAuthenticated={isAuthenticated}
        customerName={sessionUser?.name}
      />
    );
  }

  const showHighlights = !query && !machine && page === 1;
  const [catalog, highlights] = await Promise.all([
    listMektekCatalogItems({ query, machine, page, pageSize: 24 }),
    showHighlights
      ? getMektekCatalogHighlights()
      : Promise.resolve({ popular: [], newest: [] }),
  ]);

  const baseParams = new URLSearchParams();
  baseParams.set("view", "sparepart");
  if (query) baseParams.set("q", query);
  if (machine) baseParams.set("machine", machine);
  const pageHref = (targetPage: number) => {
    const nextParams = new URLSearchParams(baseParams);
    nextParams.set("page", String(targetPage));
    return `/${locale}/customer?${nextParams.toString()}`;
  };

  const catalogHref = `/${locale}/customer?view=sparepart`;
  const hasFilters = Boolean(query || machine);
  const filterSummary = [
    query ? `kata kunci "${query}"` : null,
    machine ? `mesin "${machine}"` : null,
  ]
    .filter(Boolean)
    .join(" dan ");

  return (
    <CartProvider locale={locale} isAuthenticated={isAuthenticated}>
    <main className="min-h-screen bg-[hsl(var(--brand-surface))] text-[hsl(var(--brand-navy-ink))]">
      <section className="border-b border-primary/10 bg-card/80 backdrop-blur">
        <div className={`${PAGE_SHELL} flex flex-col gap-6 py-8`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/${locale}/customer`}
              aria-label="Beranda PT Mektek Tanjung Lestari"
              className="min-w-0"
            >
              <MektekBrandMark textClassName="text-[hsl(var(--brand-navy-deep))]" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <p className={EYEBROW}>Katalog MekTek</p>
              <h1 className="text-3xl font-semibold md:text-4xl">Katalog sparepart</h1>
              <p className={`max-w-2xl ${BODY_TEXT} md:text-base`}>
                Telusuri sparepart berdasarkan model, nomor komponen, atau deskripsi.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild variant="outline" className={OUTLINE_BUTTON_ON_LIGHT}>
                <Link href={`/${locale}/customer`}>
                  <ArrowLeft aria-hidden="true" />
                  Beranda pelanggan
                </Link>
              </Button>
              <Button asChild>
                <Link
                  href={
                    isAuthenticated
                      ? `/${locale}/customer/profile`
                      : `/${locale}/customer/access?next=${encodeURIComponent(catalogHref)}`
                  }
                >
                  <UserRound aria-hidden="true" />
                  {isAuthenticated ? "Akun saya" : "Akses pelanggan"}
                </Link>
              </Button>
              <CartButton />
            </div>
          </div>

          <form
            action={`/${locale}/customer`}
            role="search"
            aria-label="Cari sparepart"
            className="grid gap-3 rounded-xl border border-primary/10 bg-[hsl(var(--brand-surface))] p-3 shadow-sm md:grid-cols-[1fr_220px_auto]"
          >
            <input type="hidden" name="view" value="sparepart" />
            <div className="min-w-0">
              <label htmlFor="catalog-query" className="sr-only">
                Kata kunci sparepart
              </label>
              <Input
                id="catalog-query"
                name="q"
                placeholder="Cari nomor komponen, nama item, atau deskripsi"
                defaultValue={query}
                className="border-primary/20 bg-card text-[hsl(var(--brand-navy-deep))] placeholder:text-[hsl(var(--brand-muted))]/70 focus-visible:ring-primary"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="catalog-machine" className="sr-only">
                Filter mesin
              </label>
              <Input
                id="catalog-machine"
                name="machine"
                list="catalog-machine-options"
                placeholder="Mesin"
                defaultValue={machine}
                className="border-primary/20 bg-card text-[hsl(var(--brand-navy-deep))] placeholder:text-[hsl(var(--brand-muted))]/70 focus-visible:ring-primary"
              />
              <datalist id="catalog-machine-options">
                {catalog.machines.map((option: string) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <Button type="submit">
              <Search data-icon="inline-start" aria-hidden="true" />
              Cari
            </Button>
          </form>
        </div>
      </section>

      <section className={`${PAGE_SHELL} flex flex-col gap-5 py-8`}>
        {showHighlights && (
          <CustomerCatalogHighlights locale={locale} {...highlights} />
        )}

        {catalog.items.length === 0 ? (
          <Card className={CARD_SURFACE}>
            <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-[hsl(var(--brand-surface-alt))] text-primary">
                <PackageSearch aria-hidden="true" className="size-7" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Sparepart tidak ditemukan</h2>
                <p className={`mx-auto max-w-md ${BODY_TEXT}`}>
                  {hasFilters
                    ? `Tidak ada item yang cocok dengan ${filterSummary}. Coba kata kunci yang lebih singkat, periksa ejaan nomor komponen, atau hapus filter mesin.`
                    : "Belum ada sparepart yang bisa ditampilkan di katalog saat ini. Silakan kembali lagi nanti atau hubungi tim MekTek."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {hasFilters && (
                  <Button asChild>
                    <Link href={catalogHref}>Tampilkan semua sparepart</Link>
                  </Button>
                )}
                <Button asChild variant="outline" className={OUTLINE_BUTTON_ON_LIGHT}>
                  <Link href={`/${locale}/customer`}>
                    <ArrowLeft aria-hidden="true" />
                    Kembali ke beranda
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[hsl(var(--brand-muted))]">
                <span className="font-semibold tabular-nums text-[hsl(var(--brand-navy-deep))]">
                  {catalog.totalCount}
                </span>{" "}
                item ditemukan
              </p>
              {hasFilters && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-[hsl(var(--brand-navy-deep))]"
                >
                  <Link href={catalogHref}>Reset Filter</Link>
                </Button>
              )}
            </div>

            <ul
              role="list"
              aria-label="Daftar sparepart"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {catalog.items.map((item: CustomerCatalogItem) => {
                const imagePath = getExistingCatalogImagePath(item.imagePath);
                const price =
                  typeof item.price === "number" && item.price > 0 ? item.price : null;

                return (
                  <li key={item.id} className="min-w-0">
                    <Card
                      className={`flex h-full flex-col overflow-hidden ${CARD_SURFACE} transition hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      <div className="aspect-[4/3] bg-[hsl(var(--brand-surface-alt))]">
                        <CatalogImage
                          src={imagePath}
                          alt={`Foto sparepart ${item.description} untuk mesin ${item.machine}`}
                        />
                      </div>
                      <CardContent className="flex min-h-56 flex-1 flex-col gap-3 p-5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="min-w-0 max-w-[60%] truncate">
                            <span className="sr-only">Mesin: </span>
                            {item.machine}
                          </Badge>
                          <AvailabilityPill available={price !== null} />
                        </div>

                        <div className="flex flex-1 flex-col gap-1.5">
                          <h3 className="line-clamp-2 text-base font-semibold leading-6">
                            {item.description}
                          </h3>
                          <p className="truncate text-xs font-medium uppercase tracking-[0.1em] text-[hsl(var(--brand-muted))]">
                            <span className="sr-only">Nomor komponen: </span>
                            {item.partNumber || "Tanpa nomor komponen"}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3">
                          <p
                            className={
                              price !== null
                                ? "text-xl font-bold leading-7 tracking-tight tabular-nums text-[hsl(var(--brand-navy-deep))]"
                                : "text-sm font-semibold leading-7 text-[hsl(var(--brand-muted))]"
                            }
                          >
                            <span className="sr-only">Harga: </span>
                            {formatPrice(price)}
                          </p>

                          {price !== null ? (
                            <ItemActions
                              item={{
                                id: item.id,
                                description: item.description,
                                price,
                                machine: item.machine ?? null,
                                partNumber: item.partNumber ?? null,
                                catalogPartNumber: null,
                                imagePath: item.imagePath ?? null,
                              }}
                            />
                          ) : (
                            <p className="rounded-lg border border-dashed border-primary/20 bg-[hsl(var(--brand-surface-alt))]/70 px-3 py-2 text-xs leading-5 text-[hsl(var(--brand-muted))]">
                              Hubungi tim MekTek untuk konfirmasi harga dan ketersediaan.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>

            {catalog.totalPages > 1 && (
              <nav
                aria-label="Navigasi halaman katalog"
                className="flex flex-col gap-3 border-t border-primary/10 pt-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm tabular-nums text-[hsl(var(--brand-muted))]">
                  Halaman {catalog.page} dari {catalog.totalPages}
                </p>
                <div className="flex gap-2">
                  {catalog.page <= 1 ? (
                    <Button variant="outline" size="sm" disabled>
                      Sebelumnya
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_ON_LIGHT}>
                      <Link href={pageHref(catalog.page - 1)} rel="prev">
                        Sebelumnya
                      </Link>
                    </Button>
                  )}
                  {catalog.page >= catalog.totalPages ? (
                    <Button variant="outline" size="sm" disabled>
                      Berikutnya
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm" className={OUTLINE_BUTTON_ON_LIGHT}>
                      <Link href={pageHref(catalog.page + 1)} rel="next">
                        Berikutnya
                      </Link>
                    </Button>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </section>
      <CartMount />
    </main>
    </CartProvider>
  );
}
