import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Mail, Phone, UserRound, Wrench } from "lucide-react";

import { getMektekCustomerProfile } from "@/actions/mektek/customer-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerServiceLiveCard } from "./_components/CustomerServiceLiveCard";
import { CustomerClaimCard } from "./_components/CustomerClaimCard";
import { CustomerVoucherList } from "./_components/CustomerVoucherList";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerLogoutButton } from "./_components/CustomerLogoutButton";

interface CustomerProfilePageProps {
  params: Promise<{ locale: string }>;
}

// One radius/border/shadow recipe for every card on this page, so the profile
// reads as a single surface instead of a stack of slightly different boxes.
const CARD_CLASS = "rounded-xl border-primary/10 bg-card shadow-sm";
// The default Button height is 40px; 44px is the minimum comfortable tap target
// on the phones this page is mostly viewed on.
const TAP_TARGET_CLASS = "h-11";

export default async function CustomerProfilePage({
  params,
}: CustomerProfilePageProps) {
  const { locale } = await params;
  const result = await getMektekCustomerProfile(locale);

  if (result.error === "Unauthorized") {
    redirect(`/${locale}/customer/access?next=${encodeURIComponent(`/${locale}/customer/profile`)}`);
  }

  const profile = result.data;

  if (!profile) {
    return (
      <main className="min-h-screen bg-muted px-4 py-8 text-[hsl(var(--brand-navy-ink))] md:px-6">
        <div className="mx-auto max-w-5xl">
          <Card className={CARD_CLASS}>
            <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
              <div>
                <h1 className="text-lg font-semibold">
                  Profil pelanggan tidak dapat dimuat
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Data profil Anda sedang tidak dapat diambil. Muat ulang halaman
                  ini, atau kembali ke beranda pelanggan lalu masuk kembali.
                </p>
              </div>
              <Button asChild className={TAP_TARGET_CLASS}>
                <Link href={`/${locale}/customer`}>Kembali ke beranda</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const identityItems = [
    {
      icon: UserRound,
      label: "Nama",
      value: profile.user.name || profile.customer?.username || "Pelanggan",
    },
    {
      icon: Phone,
      label: "Telepon",
      value: profile.user.phone || profile.customer?.phone || "Belum diisi",
    },
    {
      icon: ClipboardList,
      label: "Servis terhubung",
      value: String(profile.services.length),
    },
  ];

  return (
    <main className="min-h-screen bg-muted text-[hsl(var(--brand-navy-ink))]">
      <section className="border-b border-primary/10 bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
          <Link
            href={`/${locale}/customer`}
            className="flex min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MektekBrandMark textClassName="text-secondary-foreground" />
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[hsl(var(--brand-yellow))] text-secondary-foreground hover:bg-[hsl(var(--brand-yellow))]">
                  Profil pelanggan
                </Badge>
                {profile.customer?.customerType === "B2B" && (
                  <Badge variant="outline" className="border-primary/25">
                    Perusahaan
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Pantau servis Mektek Anda
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pesanan servis yang terhubung ke nomor telepon Anda akan diperbarui
                secara langsung saat Admin dan Technician memperbarui Progress.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className={TAP_TARGET_CLASS}>
                <Link href={`/${locale}/customer`}>Beranda pelanggan</Link>
              </Button>
              <Button asChild className={TAP_TARGET_CLASS}>
                <Link href={`/${locale}/customer?view=sparepart`}>Buka katalog</Link>
              </Button>
            </div>
          </div>

          <Card className={CARD_CLASS}>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              {identityItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="truncate text-sm font-semibold">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6">
        {profile.needsPhoneAccount && (
          <section aria-labelledby="profile-phone-account-heading">
            <Card className={CARD_CLASS}>
              <CardContent className="flex flex-col items-start gap-4 p-6">
                <div>
                  <h2
                    id="profile-phone-account-heading"
                    className="text-lg font-semibold"
                  >
                    Akun ini belum terhubung ke nomor telepon
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Belum ada nomor telepon pada sesi ini, sehingga tracking servis
                    belum dapat ditampilkan. Masuk memakai nomor telepon yang Anda
                    berikan ke bengkel untuk melihat status servis Anda.
                  </p>
                </div>
                <Button asChild className={TAP_TARGET_CLASS}>
                  <Link
                    href={`/${locale}/customer/access?next=${encodeURIComponent(
                      `/${locale}/customer/profile`
                    )}`}
                  >
                    Masuk dengan nomor telepon
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {profile.claimAvailable && (
          <CustomerClaimCard
            phone={profile.user.phone || ""}
            cardClassName={CARD_CLASS}
          />
        )}

        {!profile.needsPhoneAccount && (
          <section aria-labelledby="profile-services-heading" className="flex flex-col gap-4">
            <div>
              <h2 id="profile-services-heading" className="text-xl font-semibold tracking-tight">
                Status servis Anda
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Diperbarui otomatis begitu bengkel mencatat progres baru.
              </p>
            </div>

            {profile.services.length === 0 ? (
              <Card className={CARD_CLASS}>
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                    <Wrench aria-hidden="true" className="size-6 text-primary" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">
                      Belum ada servis yang terhubung
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      Belum ada pesanan servis atas nomor telepon ini. Bawa
                      kendaraan Anda ke bengkel Mektek atau hubungi Admin agar
                      pesanan servis dibuat — statusnya langsung muncul di sini.
                    </p>
                  </div>
                  <Button asChild variant="outline" className={TAP_TARGET_CLASS}>
                    <Link href={`/${locale}/customer`}>Lihat layanan Mektek</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {profile.services.map((service) => (
                  <CustomerServiceLiveCard
                    key={service.id}
                    initialSnapshot={service.snapshot}
                    streamHref={service.streamHref}
                    invoiceHref={service.invoiceHref}
                    receiptHref={service.receiptHref}
                    publicHref={service.publicHref}
                    payToken={service.token}
                    cardClassName={CARD_CLASS}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {!profile.needsPhoneAccount && (
          <CustomerVoucherList
            vouchers={profile.vouchers}
            catalogHref={`/${locale}/customer?view=sparepart`}
            cardClassName={CARD_CLASS}
          />
        )}

        <section aria-labelledby="profile-settings-heading">
          <Card className={CARD_CLASS}>
            <CardContent className="flex flex-col gap-4 p-6">
              <div>
                <h2 id="profile-settings-heading" className="text-lg font-semibold">
                  Pengaturan akun
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Atur email yang Anda terima atau keluar dari akun ini.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className={TAP_TARGET_CLASS}>
                  <Link href={`/${locale}/customer/profile/preferences`}>
                    <Mail data-icon="inline-start" aria-hidden="true" />
                    Preferensi email
                  </Link>
                </Button>
                <CustomerLogoutButton
                  locale={locale}
                  className={TAP_TARGET_CLASS}
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
