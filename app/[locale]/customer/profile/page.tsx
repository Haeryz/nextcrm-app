import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Phone, UserRound } from "lucide-react";

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
      <main className="min-h-screen bg-[#f7f8ff] px-4 py-8 text-[#091247] md:px-6">
        <div className="mx-auto max-w-5xl">
          <Card className="border-[#151a63]/10 bg-white">
            <CardContent className="p-8 text-sm text-[#4b5577]">
              Profil pelanggan tidak dapat dimuat.
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <section className="border-b border-[#151a63]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/${locale}/customer`} className="min-w-0">
              <MektekBrandMark textClassName="text-[#10164f]" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge className="bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
                Profil pelanggan
              </Badge>
              {profile.customer?.customerType === "B2B" && (
                <Badge
                  variant="outline"
                  className="ml-2 border-[#151a63]/25 text-[#10164f]"
                >
                  Perusahaan
                </Badge>
              )}
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Pantau servis Mektek Anda
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#4b5577]">
                Pesanan servis yang terhubung ke nomor telepon Anda akan diperbarui
                secara langsung saat Admin dan Technician memperbarui Progress.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                asChild
                variant="outline"
                className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
              >
                <Link href={`/${locale}/customer`}>Beranda pelanggan</Link>
              </Button>
              <Button
                asChild
                className="bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
              >
                <Link href={`/${locale}/customer?view=sparepart`}>Buka katalog</Link>
              </Button>
              <CustomerLogoutButton locale={locale} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-[#151a63]/10 bg-[#fafbff]">
              <CardContent className="flex items-center gap-3 p-4">
                <UserRound className="size-5 text-[#151a63]" />
                <div className="min-w-0">
                  <p className="text-xs text-[#4b5577]">Nama</p>
                  <p className="truncate text-sm font-semibold">
                    {profile.user.name || profile.customer?.username || "Pelanggan"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#151a63]/10 bg-[#fafbff]">
              <CardContent className="flex items-center gap-3 p-4">
                <Phone className="size-5 text-[#151a63]" />
                <div className="min-w-0">
                  <p className="text-xs text-[#4b5577]">Telepon</p>
                  <p className="truncate text-sm font-semibold">
                    {profile.user.phone || profile.customer?.phone || "Belum diisi"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#151a63]/10 bg-[#fafbff]">
              <CardContent className="flex items-center gap-3 p-4">
                <ClipboardList className="size-5 text-[#151a63]" />
                <div>
                  <p className="text-xs text-[#4b5577]">Servis</p>
                  <p className="text-sm font-semibold">{profile.services.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 md:px-6">
        {profile.needsPhoneAccount && (
          <Card className="border-[#151a63]/10 bg-white">
            <CardContent className="p-6 text-sm text-[#4b5577]">
              Sesi ini belum terhubung ke akun pelanggan berbasis nomor telepon.
              Login dengan nomor telepon Anda untuk melihat tracking servis.
            </CardContent>
          </Card>
        )}

        {profile.claimAvailable && (
          <CustomerClaimCard phone={profile.user.phone || ""} />
        )}

        {!profile.needsPhoneAccount && profile.vouchers.length > 0 && (
          <CustomerVoucherList vouchers={profile.vouchers} />
        )}

        {!profile.needsPhoneAccount && profile.services.length === 0 && (
          <Card className="border-[#151a63]/10 bg-white">
            <CardContent className="p-8 text-center">
              <h2 className="text-lg font-semibold">Belum ada servis yang terhubung</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#4b5577]">
                Pesanan servis akan muncul di sini secara otomatis setelah Admin
                membuatnya menggunakan nomor telepon ini.
              </p>
            </CardContent>
          </Card>
        )}

        {profile.services.map((service) => (
          <CustomerServiceLiveCard
            key={service.id}
            initialSnapshot={service.snapshot}
            streamHref={service.streamHref}
            invoiceHref={service.invoiceHref}
            receiptHref={service.receiptHref}
            publicHref={service.publicHref}
            payToken={service.token}
          />
        ))}
      </section>
    </main>
  );
}
