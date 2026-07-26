import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { readEmailPreference } from "@/actions/email/preferences";
import { getCustomerAuthSession } from "@/lib/customer-auth";
import { prismadb } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";
import { CustomerEmailPreferencesForm } from "./_components/CustomerEmailPreferencesForm";

// Accounts created from a phone number only carry a synthesized address that no
// inbox is ever behind, so opting in would be meaningless for them.
const PHONE_PLACEHOLDER_SUFFIX = "@phone.nextcrm.local";

interface CustomerPreferencesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CustomerPreferencesPage({
  params,
}: CustomerPreferencesPageProps) {
  const { locale } = await params;
  const session = await getCustomerAuthSession();

  if (!session?.user?.id) {
    redirect(
      `/${locale}/customer/access?next=${encodeURIComponent(
        `/${locale}/customer/profile/preferences`
      )}`
    );
  }

  const userId = session.user.id;
  const user = await prismadb.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const email = user?.email ?? "";
  const hasRealEmail =
    email.length > 0 &&
    !email.toLowerCase().endsWith(PHONE_PLACEHOLDER_SUFFIX);

  // Session already resolved above, so the internal reader is used instead of
  // paying for a second session lookup inside getEmailPreference.
  const preference = await readEmailPreference(userId);

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#091247]">
      <section className="border-b border-[#151a63]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
          <Link href={`/${locale}/customer`} className="min-w-0">
            <MektekBrandMark textClassName="text-[#10164f]" />
          </Link>

          <div>
            <Badge className="bg-[#fff200] text-[#10164f] hover:bg-[#fff200]">
              Preferensi email
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Atur email yang Anda terima
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#4b5577]">
              Anda yang menentukan. Email penting seperti kode verifikasi, status
              servis, dan bukti pembayaran tetap dikirim karena bagian dari layanan
              Anda.
            </p>
          </div>

          <div>
            <Button
              asChild
              variant="outline"
              className="border-[#151a63]/20 bg-white/80 text-[#10164f] hover:bg-[#eef1ff]"
            >
              <Link href={`/${locale}/customer/profile`}>
                <ArrowLeft data-icon="inline-start" />
                Kembali ke profil
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-6 md:px-6">
        {!hasRealEmail ? (
          <Card className="border-[#151a63]/10 bg-white">
            <CardContent className="p-6 text-sm leading-6 text-[#4b5577]">
              Akun Anda belum memiliki alamat email asli, sehingga kami belum dapat
              mengirimkan email apa pun. Hubungi tim Mektek untuk menambahkan email
              Anda, lalu preferensi ini dapat diatur di sini.
            </CardContent>
          </Card>
        ) : (
          <CustomerEmailPreferencesForm
            userId={userId}
            email={email}
            marketing={preference?.marketingOptedInAt !== null && preference?.marketingOptedInAt !== undefined}
            offers={preference?.offersOptedInAt !== null && preference?.offersOptedInAt !== undefined}
          />
        )}
      </section>
    </main>
  );
}
